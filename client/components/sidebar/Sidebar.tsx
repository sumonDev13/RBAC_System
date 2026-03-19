import Link from "next/link";
import { useSelector } from "react-redux";

const menuItems = [
  { name: "Dashboard", path: "/", permission: "view_dashboard" },
  { name: "Users", path: "/users", permission: "manage_users" },
  { name: "Reports", path: "/reports", permission: "view_reports" },
];

const Sidebar = () => {
  const permissions = useSelector((s: any) => s.permissions.list);

  const filtered = menuItems.filter(item =>
    permissions.includes(item.permission)
  );

  return (
    <div>
      {filtered.map(item => (
        <Link key={item.path} href={item.path}>
          {item.name}
        </Link>
      ))}
    </div>
  );
};