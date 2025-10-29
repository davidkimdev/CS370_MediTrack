import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/authService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { UserCheck, UserX, Clock, Shield, Users, Mail, User, Calendar } from 'lucide-react';
import { UserProfile } from '../../types/auth';
import { logger } from '../../utils/logger';

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Only admins can access this component
  if (user?.profile?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="size-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            Administrator privileges are required to access this panel.
          </p>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const usersData = await AuthService.getAllUsers();
      setUsers(usersData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      logger.error('Failed to load users in admin panel', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await AuthService.approveUser(userId, user?.email || 'Admin');
      await loadUsers(); // Refresh the list
      logger.info('User approved successfully', { userId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve user';
      setError(errorMessage);
      logger.error('Failed to approve user', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      await AuthService.rejectUser(userId);
      await loadUsers(); // Refresh the list
      logger.info('User rejected successfully', { userId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject user';
      setError(errorMessage);
      logger.error('Failed to reject user', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const pendingUsers = users.filter(u => !u.isApproved);
  const approvedUsers = users.filter(u => u.isApproved);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{approvedUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold">{pendingUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Users */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-orange-600" />
              Pending Approval ({pendingUsers.length})
            </CardTitle>
            <CardDescription>
              New user registrations waiting for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-muted rounded-full flex items-center justify-center">
                      <User className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveUser(user.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <UserCheck className="size-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectUser(user.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <UserX className="size-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            All Users
          </CardTitle>
          <CardDescription>
            Complete list of all registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Administrator' : 'Staff'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isApproved ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <UserCheck className="size-3 mr-1" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          <Clock className="size-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </SheetTrigger>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>User Details</SheetTitle>
                          </SheetHeader>
                          <div className="mt-6 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Name</label>
                              <p className="text-sm">{user.firstName} {user.lastName}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Email</label>
                              <p className="text-sm">{user.email}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Role</label>
                              <p className="text-sm">{user.role === 'admin' ? 'Administrator' : 'Staff'}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Status</label>
                              <p className="text-sm">
                                {user.isApproved ? 'Approved' : 'Pending Approval'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Registration Date</label>
                              <p className="text-sm">{new Date(user.createdAt).toLocaleString()}</p>
                            </div>
                            {user.approvedAt && user.approvedBy && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Approved</label>
                                <p className="text-sm">
                                  {new Date(user.approvedAt).toLocaleString()}
                                  <br />
                                  <span className="text-muted-foreground">by {user.approvedBy}</span>
                                </p>
                              </div>
                            )}
                            
                            {!user.isApproved && (
                              <div className="pt-4 space-y-2">
                                <Button
                                  onClick={() => handleApproveUser(user.id)}
                                  className="w-full bg-green-600 hover:bg-green-700"
                                >
                                  <UserCheck className="size-4 mr-2" />
                                  Approve User
                                </Button>
                                <Button
                                  onClick={() => handleRejectUser(user.id)}
                                  variant="outline"
                                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <UserX className="size-4 mr-2" />
                                  Reject User
                                </Button>
                              </div>
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}