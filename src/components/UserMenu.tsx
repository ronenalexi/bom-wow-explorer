import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, User, Shield } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-destructive/20 text-destructive border-destructive/30',
  operator: 'bg-primary/20 text-primary border-primary/30',
  viewer: 'bg-muted text-muted-foreground border-border',
};

export default function UserMenu() {
  const { user, role, signOut } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <User className="w-3.5 h-3.5" />
          <span className="text-xs max-w-[120px] truncate">{user.email}</span>
          {role && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[role] || ''}`}>
              {role}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground capitalize">{role} access</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive gap-2">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
