// @ts-nocheck
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase environment variables are not configured');
}

const PROFILE_FIELDS =
  'id, email, first_name, last_name, role, is_approved, approved_by, approved_at, created_at';

const createAdminClient = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

const serializeProfile = (profile) => ({
  id: profile.id,
  email: profile.email,
  firstName: profile.first_name,
  lastName: profile.last_name,
  role: profile.role,
  isApproved: profile.is_approved,
  approvedBy: profile.approved_by ?? null,
  approvedAt: profile.approved_at ?? null,
  createdAt: profile.created_at,
});

const getAdminContext = async (c, requestId) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[admin-auth] missing authorization header`, { requestId });
    return { error: c.json({ error: 'Unauthorized' }, 401) };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    console.warn(`[admin-auth] empty bearer token`, { requestId });
    return { error: c.json({ error: 'Unauthorized' }, 401) };
  }

  const supabaseAdmin = createAdminClient();

  const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.getUser(token);
  if (authUserError || !authUserData?.user) {
    console.warn(`[admin-auth] failed to validate admin token`, { requestId, error: authUserError });
    return { error: c.json({ error: 'Unauthorized' }, 401) };
  }

  const adminUserId = authUserData.user.id;

  const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', adminUserId)
    .maybeSingle();

  if (adminProfileError) {
    console.error(`[admin-auth] failed to load admin profile`, { requestId, error: adminProfileError });
    return { error: c.json({ error: 'Unable to validate admin status' }, 500) };
  }

  if (adminProfile?.role !== 'admin') {
    console.warn(`[admin-auth] non-admin attempted privileged action`, { requestId, adminUserId });
    return { error: c.json({ error: 'Forbidden' }, 403) };
  }

  return { supabaseAdmin, adminUserId };
};

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  '/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get('/make-server-be81afe8/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/make-server-be81afe8/admin/reject-user', async (c) => {
  const requestId = crypto.randomUUID();
  console.log(`[reject-user] request received`, { requestId });

  const adminContext = await getAdminContext(c, requestId);
  if ('error' in adminContext) {
    return adminContext.error;
  }

  const { supabaseAdmin, adminUserId } = adminContext;

  let body: { userId?: string };
  try {
    body = await c.req.json();
  } catch (error) {
    console.warn(`[reject-user] invalid JSON body`, { requestId, error });
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body?.userId || typeof body.userId !== 'string') {
    console.warn(`[reject-user] missing userId`, { requestId });
    return c.json({ error: 'userId is required' }, 400);
  }

  if (body.userId === adminUserId) {
    console.warn(`[reject-user] admin attempted to delete self`, { requestId, adminUserId });
    return c.json({ error: 'Cannot delete active admin' }, 400);
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', body.userId)
    .maybeSingle();

  if (targetProfileError) {
    console.error(`[reject-user] failed to lookup target profile`, { requestId, error: targetProfileError });
    return c.json({ error: 'Failed to lookup user' }, 500);
  }

  if (!targetProfile) {
    console.warn(`[reject-user] profile not found`, { requestId, userId: body.userId });
    return c.json({ error: 'User not found' }, 404);
  }

  if (targetProfile.role === 'admin') {
    console.warn(`[reject-user] attempted to delete admin account`, { requestId, userId: body.userId });
    return c.json({ error: 'Cannot remove administrator accounts' }, 400);
  }

  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(body.userId);
  if (deleteAuthError && deleteAuthError.message !== 'User not found') {
    console.error(`[reject-user] failed to delete auth user`, { requestId, error: deleteAuthError });
    return c.json({ error: 'Failed to delete auth user' }, 500);
  }

  const { error: deleteProfileError } = await supabaseAdmin
    .from('user_profiles')
    .delete()
    .eq('id', body.userId);

  if (deleteProfileError) {
    console.error(`[reject-user] failed to delete profile`, { requestId, error: deleteProfileError });
    return c.json({ error: 'Auth user deleted but profile cleanup failed' }, 500);
  }

  console.log(`[reject-user] cleanup complete`, { requestId, userId: body.userId });
  return c.json({ success: true });
});

app.post('/make-server-be81afe8/admin/update-profile', async (c) => {
  const requestId = crypto.randomUUID();
  console.log(`[update-profile] request received`, { requestId });

  const adminContext = await getAdminContext(c, requestId);
  if ('error' in adminContext) {
    return adminContext.error;
  }

  const { supabaseAdmin, adminUserId } = adminContext;

  let body: { userId?: string; updates?: { role?: string; isApproved?: boolean } };
  try {
    body = await c.req.json();
  } catch (error) {
    console.warn(`[update-profile] invalid JSON body`, { requestId, error });
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body?.userId || typeof body.userId !== 'string') {
    console.warn(`[update-profile] missing userId`, { requestId });
    return c.json({ error: 'userId is required' }, 400);
  }

  const requestedRole = body.updates?.role;
  const requestedApproval = body.updates?.isApproved;

  if (requestedRole === undefined && requestedApproval === undefined) {
    console.warn(`[update-profile] no updates requested`, { requestId });
    return c.json({ error: 'No changes submitted' }, 400);
  }

  if (requestedRole !== undefined && requestedRole !== 'admin' && requestedRole !== 'staff') {
    console.warn(`[update-profile] invalid role requested`, { requestId, requestedRole });
    return c.json({ error: 'Invalid role value' }, 400);
  }

  if (requestedApproval !== undefined && typeof requestedApproval !== 'boolean') {
    console.warn(`[update-profile] invalid approval flag`, { requestId });
    return c.json({ error: 'Invalid approval value' }, 400);
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from('user_profiles')
    .select(PROFILE_FIELDS)
    .eq('id', body.userId)
    .maybeSingle();

  if (targetProfileError) {
    console.error(`[update-profile] failed to lookup target profile`, { requestId, error: targetProfileError });
    return c.json({ error: 'Failed to lookup user' }, 500);
  }

  if (!targetProfile) {
    console.warn(`[update-profile] profile not found`, { requestId, userId: body.userId });
    return c.json({ error: 'User not found' }, 404);
  }

  if (body.userId === adminUserId && requestedRole && requestedRole !== targetProfile.role) {
    console.warn(`[update-profile] admin attempted to modify own role`, { requestId, adminUserId });
    return c.json({ error: 'Cannot change your own role' }, 400);
  }

  const updatePayload = {} as Record<string, unknown>;

  if (requestedRole && requestedRole !== targetProfile.role) {
    updatePayload.role = requestedRole;
  }

  if (requestedApproval !== undefined && requestedApproval !== targetProfile.is_approved) {
    updatePayload.is_approved = requestedApproval;
    updatePayload.approved_by = requestedApproval ? adminUserId : null;
    updatePayload.approved_at = requestedApproval ? new Date().toISOString() : null;
  }

  if (Object.keys(updatePayload).length === 0) {
    console.log(`[update-profile] no changes detected`, { requestId });
    return c.json({ success: true, profile: serializeProfile(targetProfile) });
  }

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', body.userId)
    .select(PROFILE_FIELDS)
    .maybeSingle();

  if (updateError) {
    console.error(`[update-profile] failed to update profile`, { requestId, error: updateError });
    return c.json({ error: 'Failed to update profile' }, 500);
  }

  console.log(`[update-profile] update complete`, { requestId, userId: body.userId, changes: Object.keys(updatePayload) });
  return c.json({ success: true, profile: serializeProfile(updatedProfile) });
});

Deno.serve(app.fetch);
