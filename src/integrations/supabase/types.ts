export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          database_id: string
          is_active: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          database_id: string
          is_active?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          database_id?: string
          is_active?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          status: string
          joined_at: string
          invited_by: string | null
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          status?: string
          joined_at?: string
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          status?: string
          joined_at?: string
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          updated_at: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          updated_at?: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: 'master' | 'admin' | 'manager' | 'tester' | 'viewer'
          updated_at?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      test_cases: {
        Row: {
          created_at: string
          description: string | null
          expected_result: string | null
          generated_by_ai: boolean
          id: string
          plan_id: string | null
          preconditions: string | null
          priority: string
          steps: Json
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_result?: string | null
          generated_by_ai?: boolean
          id?: string
          plan_id?: string | null
          preconditions?: string | null
          priority?: string
          steps?: Json
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_result?: string | null
          generated_by_ai?: boolean
          id?: string
          plan_id?: string | null
          preconditions?: string | null
          priority?: string
          steps?: Json
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_executions: {
        Row: {
          actual_result: string | null
          case_id: string
          executed_at: string
          executed_by: string
          id: string
          notes: string | null
          plan_id: string
          status: string
          user_id: string
        }
        Insert: {
          actual_result?: string | null
          case_id: string
          executed_at?: string
          executed_by: string
          id?: string
          notes?: string | null
          plan_id: string
          status?: string
          user_id: string
        }
        Update: {
          actual_result?: string | null
          case_id?: string
          executed_at?: string
          executed_by?: string
          id?: string
          notes?: string | null
          plan_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_executions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plans: {
        Row: {
          approach: string | null
          created_at: string
          criteria: string | null
          description: string | null
          generated_by_ai: boolean
          id: string
          objective: string | null
          resources: string | null
          risks: string | null
          schedule: string | null
          scope: string | null
          title: string
          updated_at: string
          user_id: string
          organization_id: string | null
        }
        Insert: {
          approach?: string | null
          created_at?: string
          criteria?: string | null
          description?: string | null
          generated_by_ai?: boolean
          id?: string
          objective?: string | null
          resources?: string | null
          risks?: string | null
          schedule?: string | null
          scope?: string | null
          title: string
          updated_at?: string
          user_id: string
          organization_id?: string | null
        }
        Update: {
          approach?: string | null
          created_at?: string
          criteria?: string | null
          description?: string | null
          generated_by_ai?: boolean
          id?: string
          objective?: string | null
          resources?: string | null
          risks?: string | null
          schedule?: string | null
          scope?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_plans_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          can_manage_users: boolean
          can_manage_plans: boolean
          can_manage_cases: boolean
          can_manage_executions: boolean
          can_view_reports: boolean
          can_use_ai: boolean
          can_access_model_control: boolean
          can_configure_ai_models: boolean
          can_test_ai_connections: boolean
          can_manage_ai_templates: boolean
          can_select_ai_models: boolean
          can_access_todo: boolean
          can_manage_todo_folders: boolean
          can_manage_todo_tasks: boolean
          can_manage_all_todos: boolean
          can_upload_attachments: boolean
          can_comment_tasks: boolean
          can_assign_tasks: boolean
          created_at: string
          updated_at: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          can_manage_users?: boolean
          can_manage_plans?: boolean
          can_manage_cases?: boolean
          can_manage_executions?: boolean
          can_view_reports?: boolean
          can_use_ai?: boolean
          can_access_model_control?: boolean
          can_configure_ai_models?: boolean
          can_test_ai_connections?: boolean
          can_manage_ai_templates?: boolean
          can_select_ai_models?: boolean
          can_access_todo?: boolean
          can_manage_todo_folders?: boolean
          can_manage_todo_tasks?: boolean
          can_manage_all_todos?: boolean
          can_upload_attachments?: boolean
          can_comment_tasks?: boolean
          can_assign_tasks?: boolean
          created_at?: string
          updated_at?: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          can_manage_users?: boolean
          can_manage_plans?: boolean
          can_manage_cases?: boolean
          can_manage_executions?: boolean
          can_view_reports?: boolean
          can_use_ai?: boolean
          can_access_model_control?: boolean
          can_configure_ai_models?: boolean
          can_test_ai_connections?: boolean
          can_manage_ai_templates?: boolean
          can_select_ai_models?: boolean
          can_access_todo?: boolean
          can_manage_todo_folders?: boolean
          can_manage_todo_tasks?: boolean
          can_manage_all_todos?: boolean
          can_upload_attachments?: boolean
          can_comment_tasks?: boolean
          can_assign_tasks?: boolean
          created_at?: string
          updated_at?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          icon: string
          parent_folder_id: string | null
          position: number
          is_archived: boolean
          is_shared: boolean
          shared_with: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string
          icon?: string
          parent_folder_id?: string | null
          position?: number
          is_archived?: boolean
          is_shared?: boolean
          shared_with?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string
          parent_folder_id?: string | null
          position?: number
          is_archived?: boolean
          is_shared?: boolean
          shared_with?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_folders_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            referencedRelation: "todo_folders"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_tasks: {
        Row: {
          id: string
          folder_id: string
          user_id: string
          assigned_to: string | null
          title: string
          description: string | null
          content: Json | null
          priority: string
          status: string
          due_date: string | null
          start_date: string | null
          completed_at: string | null
          position: number
          tags: string[]
          linked_plan_id: string | null
          linked_case_id: string | null
          linked_execution_id: string | null
          estimated_hours: number | null
          actual_hours: number | null
          progress_percentage: number
          is_recurring: boolean
          recurrence_pattern: Json | null
          reminder_date: string | null
          is_template: boolean
          template_name: string | null
          view_count: number
          last_viewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folder_id: string
          user_id: string
          assigned_to?: string | null
          title: string
          description?: string | null
          content?: Json | null
          priority?: string
          status?: string
          due_date?: string | null
          start_date?: string | null
          completed_at?: string | null
          position?: number
          tags?: string[]
          linked_plan_id?: string | null
          linked_case_id?: string | null
          linked_execution_id?: string | null
          estimated_hours?: number | null
          actual_hours?: number | null
          progress_percentage?: number
          is_recurring?: boolean
          recurrence_pattern?: Json | null
          reminder_date?: string | null
          is_template?: boolean
          template_name?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folder_id?: string
          user_id?: string
          assigned_to?: string | null
          title?: string
          description?: string | null
          content?: Json | null
          priority?: string
          status?: string
          due_date?: string | null
          start_date?: string | null
          completed_at?: string | null
          position?: number
          tags?: string[]
          linked_plan_id?: string | null
          linked_case_id?: string | null
          linked_execution_id?: string | null
          estimated_hours?: number | null
          actual_hours?: number | null
          progress_percentage?: number
          is_recurring?: boolean
          recurrence_pattern?: Json | null
          reminder_date?: string | null
          is_template?: boolean
          template_name?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_tasks_folder_id_fkey"
            columns: ["folder_id"]
            referencedRelation: "todo_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_linked_plan_id_fkey"
            columns: ["linked_plan_id"]
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_linked_case_id_fkey"
            columns: ["linked_case_id"]
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_linked_execution_id_fkey"
            columns: ["linked_execution_id"]
            referencedRelation: "test_executions"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_subtasks: {
        Row: {
          id: string
          task_id: string
          title: string
          description: string | null
          is_completed: boolean
          position: number
          due_date: string | null
          assigned_to: string | null
          estimated_minutes: number | null
          actual_minutes: number | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          description?: string | null
          is_completed?: boolean
          position?: number
          due_date?: string | null
          assigned_to?: string | null
          estimated_minutes?: number | null
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          description?: string | null
          is_completed?: boolean
          position?: number
          due_date?: string | null
          assigned_to?: string | null
          estimated_minutes?: number | null
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_subtasks_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_subtasks_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_attachments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          filename: string
          original_filename: string
          file_size: number
          mime_type: string
          file_path: string
          storage_bucket: string
          description: string | null
          version: number
          is_active: boolean
          download_count: number
          last_downloaded_at: string | null
          checksum: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          filename: string
          original_filename: string
          file_size: number
          mime_type: string
          file_path: string
          storage_bucket?: string
          description?: string | null
          version?: number
          is_active?: boolean
          download_count?: number
          last_downloaded_at?: string | null
          checksum?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          filename?: string
          original_filename?: string
          file_size?: number
          mime_type?: string
          file_path?: string
          storage_bucket?: string
          description?: string | null
          version?: number
          is_active?: boolean
          download_count?: number
          last_downloaded_at?: string | null
          checksum?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_attachments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_attachments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          content_type: string
          is_edited: boolean
          parent_comment_id: string | null
          mentions: string[]
          reactions: Json
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          content_type?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          mentions?: string[]
          reactions?: Json
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          content_type?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          mentions?: string[]
          reactions?: Json
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_comments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            referencedRelation: "todo_comments"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_activity_log: {
        Row: {
          id: string
          task_id: string | null
          folder_id: string | null
          user_id: string
          action: string
          entity_type: string
          entity_id: string | null
          old_values: Json | null
          new_values: Json | null
          description: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          folder_id?: string | null
          user_id: string
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          description?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          folder_id?: string | null
          user_id?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          description?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_activity_log_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_activity_log_folder_id_fkey"
            columns: ["folder_id"]
            referencedRelation: "todo_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_activity_log_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      todo_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          category: string | null
          template_data: Json
          is_public: boolean
          usage_count: number
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          category?: string | null
          template_data: Json
          is_public?: boolean
          usage_count?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          category?: string | null
          template_data?: Json
          is_public?: boolean
          usage_count?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_templates_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      access_tokens: {
        Row: {
          id: string
          organization_id: string
          token: string
          description: string | null
          created_by: string
          expires_at: string
          max_uses: number
          current_uses: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          token: string
          description?: string | null
          created_by: string
          expires_at: string
          max_uses?: number
          current_uses?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          token?: string
          description?: string | null
          created_by?: string
          expires_at?: string
          max_uses?: number
          current_uses?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_tokens_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      access_logs: {
        Row: {
          id: string
          organization_id: string | null
          token_id: string | null
          user_email: string | null
          user_ip: string | null
          user_agent: string | null
          action: string
          status: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          token_id?: string | null
          user_email?: string | null
          user_ip?: string | null
          user_agent?: string | null
          action: string
          status: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          token_id?: string | null
          user_email?: string | null
          user_ip?: string | null
          user_agent?: string | null
          action?: string
          status?: string
          details?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_token_id_fkey"
            columns: ["token_id"]
            referencedRelation: "access_tokens"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_access_token: {
        Args: {
          org_uuid: string
          token_description?: string
          token_duration_seconds?: number
          max_uses_count?: number
        }
        Returns: string
      }
      validate_and_use_token: {
        Args: {
          token_string: string
          user_email?: string
          user_ip?: string
          user_agent?: string
        }
        Returns: Json
      }
      cleanup_expired_tokens: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      user_role: "master" | "admin" | "manager" | "tester" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never