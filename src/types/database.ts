export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type OrganizationRole = 'owner' | 'manager' | 'employee';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          full_name: string;
          preferred_language: 'en' | 'am';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string;
          preferred_language?: 'en' | 'am';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          preferred_language?: 'en' | 'am';
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          default_language: 'en' | 'am';
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          default_language?: 'en' | 'am';
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          timezone?: string;
          default_language?: 'en' | 'am';
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          job_title: string | null;
          joined_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: OrganizationRole;
          job_title?: string | null;
          joined_at?: string;
        };
        Update: {
          role?: OrganizationRole;
          job_title?: string | null;
        };
        Relationships: [];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: 'manager' | 'employee';
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: 'manager' | 'employee';
          token_hash: string;
          created_by: string;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          accepted_by?: string | null;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_at: string | null;
          assignee_id: string | null;
          created_by: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_at?: string | null;
          assignee_id?: string | null;
          created_by: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_at?: string | null;
          assignee_id?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          location: string | null;
          meeting_url: string | null;
          organizer_id: string;
          status: 'scheduled' | 'cancelled';
          attendee_emails: string[];
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          location?: string | null;
          meeting_url?: string | null;
          organizer_id: string;
          status?: 'scheduled' | 'cancelled';
          attendee_emails?: string[];
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          starts_at?: string;
          ends_at?: string;
          location?: string | null;
          meeting_url?: string | null;
          status?: 'scheduled' | 'cancelled';
          attendee_emails?: string[];
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string;
          status: 'processing' | 'ready' | 'failed';
          content_text: string;
          extraction_error: string | null;
          search_vector: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by: string;
          status?: 'processing' | 'ready' | 'failed';
          content_text?: string;
          extraction_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          status?: 'processing' | 'ready' | 'failed';
          content_text?: string;
          extraction_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_drafts: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          to_emails: string[];
          cc_emails: string[];
          bcc_emails: string[];
          subject: string;
          body_text: string;
          status: 'draft' | 'sending' | 'sent' | 'failed';
          sent_at: string | null;
          provider_message_id: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          to_emails: string[];
          cc_emails?: string[];
          bcc_emails?: string[];
          subject: string;
          body_text: string;
          status?: 'draft' | 'sending' | 'sent' | 'failed';
          sent_at?: string | null;
          provider_message_id?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          to_emails?: string[];
          cc_emails?: string[];
          bcc_emails?: string[];
          subject?: string;
          body_text?: string;
          status?: 'draft' | 'sending' | 'sent' | 'failed';
          sent_at?: string | null;
          provider_message_id?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_email_settings: {
        Row: {
          organization_id: string;
          provider: 'gmail' | 'microsoft365' | 'zoho' | 'cpanel' | 'custom';
          smtp_host: string;
          smtp_port: number;
          smtp_secure: boolean;
          smtp_require_tls: boolean;
          smtp_username: string;
          smtp_password_encrypted: string;
          from_name: string;
          from_email: string;
          reply_to: string | null;
          last_tested_at: string | null;
          last_test_status: 'passed' | 'failed' | null;
          last_test_error: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          provider: 'gmail' | 'microsoft365' | 'zoho' | 'cpanel' | 'custom';
          smtp_host: string;
          smtp_port: number;
          smtp_secure?: boolean;
          smtp_require_tls?: boolean;
          smtp_username: string;
          smtp_password_encrypted: string;
          from_name: string;
          from_email: string;
          reply_to?: string | null;
          last_tested_at?: string | null;
          last_test_status?: 'passed' | 'failed' | null;
          last_test_error?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider?: 'gmail' | 'microsoft365' | 'zoho' | 'cpanel' | 'custom';
          smtp_host?: string;
          smtp_port?: number;
          smtp_secure?: boolean;
          smtp_require_tls?: boolean;
          smtp_username?: string;
          smtp_password_encrypted?: string;
          from_name?: string;
          from_email?: string;
          reply_to?: string | null;
          last_tested_at?: string | null;
          last_test_status?: 'passed' | 'failed' | null;
          last_test_error?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_action_log: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          conversation_id: string | null;
          tool_name: string;
          status: 'proposed' | 'approved' | 'executed' | 'rejected' | 'failed';
          input: Json;
          result: Json | null;
          created_at: string;
          executed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          conversation_id?: string | null;
          tool_name: string;
          status: 'proposed' | 'approved' | 'executed' | 'rejected' | 'failed';
          input?: Json;
          result?: Json | null;
          created_at?: string;
          executed_at?: string | null;
        };
        Update: {
          status?: 'proposed' | 'approved' | 'executed' | 'rejected' | 'failed';
          result?: Json | null;
          executed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_organization_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      has_organization_role: {
        Args: { target_organization_id: string; allowed_roles: string[] };
        Returns: boolean;
      };
      create_organization_with_owner: {
        Args: {
          organization_name: string;
          organization_slug: string;
          organization_language?: 'en' | 'am';
        };
        Returns: string;
      };
      create_organization_invitation: {
        Args: {
          target_organization_id: string;
          invite_email: string;
          invite_role?: 'manager' | 'employee';
          valid_days?: number;
        };
        Returns: string;
      };
      accept_organization_invitation: {
        Args: { invitation_token: string };
        Returns: string;
      };
      search_company_documents: {
        Args: {
          target_organization_id: string;
          search_query: string;
          result_limit?: number;
        };
        Returns: {
          id: string;
          name: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string;
          created_at: string;
          status: 'processing' | 'ready' | 'failed';
          excerpt: string;
          rank: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
