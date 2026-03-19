import { useSelector } from "react-redux";

export const usePermission = (permission: string) => {
  const permissions = useSelector((state: any) => state.permissions.list);
  return permissions.includes(permission);
};