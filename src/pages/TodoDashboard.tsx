import React, { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  FolderPlus,
  Calendar,
  Clock,
  User,
  Tag,
  MoreHorizontal,
  FileText,
  TestTube,
  PlayCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PermissionGuard } from '@/components/PermissionGuard';
import { FolderManager } from '@/components/todo/FolderManager';
import { TaskManager } from '@/components/todo/TaskManager';

export const TodoDashboard = () => {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState('Todas as Tarefas');

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    // You can add logic here to get folder name or pass it from FolderManager
    setSelectedFolderName(folderId ? 'Pasta Selecionada' : 'Todas as Tarefas');
  };

  if (!hasPermission('can_access_todo')) {
    return (
      <PermissionGuard requiredPermission="can_access_todo">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar o To-Do List</p>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-8 w-8" />
            To-Do List
          </h1>
          <p className="text-muted-foreground">
            Sistema integrado de gerenciamento de tarefas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar com Pastas */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4">
              <FolderManager 
                selectedFolderId={selectedFolderId}
                onFolderSelect={handleFolderSelect}
                showCreateButton={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Área Principal de Tarefas */}
        <div className="lg:col-span-3">
          <TaskManager 
            folderId={selectedFolderId}
            folderName={selectedFolderName}
          />
        </div>
      </div>
    </div>
  );
}; 