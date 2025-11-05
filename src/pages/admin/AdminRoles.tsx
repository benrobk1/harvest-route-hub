import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AdminRoleManager } from "@/features/admin";

const AdminRoles = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      
      <div>
        <h1 className="text-3xl font-bold">Admin Role Management</h1>
        <p className="text-muted-foreground">Manage administrator access and permissions</p>
      </div>

      <AdminRoleManager />
    </div>
  );
};

export default AdminRoles;
