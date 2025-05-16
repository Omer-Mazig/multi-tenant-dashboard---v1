import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Error is handled by the auth context
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.name || "User"}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Secure Dashboard</CardTitle>
          <CardDescription>You are logged in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-medium mb-2">Your Account</h3>
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h3 className="text-lg font-medium">Your Tenants</h3>
            {user?.tenants && user.tenants.length > 0 ? (
              user.tenants.map((tenant) => (
                <div
                  key={tenant}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <span>
                    <strong>{tenant}</strong>
                  </span>
                  <a
                    href={`http://login.lvh.me:5173/api/auth/init-session/${tenant}`}
                    className="ml-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Login to {tenant}
                  </a>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No tenants available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
