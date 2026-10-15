
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "contacts": {
                  Row: {
                    "created_at": string,"email": string | null,"has_spoken": boolean,"id": string,"last_contacted": string | null,"linkedin_url": string | null,"name": string | null,"next_follow_up": string | null,"notes": string | null,"opportunity_id": string,"outreach_status": Database["public"]['Enums']["outreach_status"],"title": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"has_spoken"?: boolean,"id"?: string,"last_contacted"?: string | null,"linkedin_url"?: string | null,"name"?: string | null,"next_follow_up"?: string | null,"notes"?: string | null,"opportunity_id": string,"outreach_status"?: Database["public"]['Enums']["outreach_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"has_spoken"?: boolean,"id"?: string,"last_contacted"?: string | null,"linkedin_url"?: string | null,"name"?: string | null,"next_follow_up"?: string | null,"notes"?: string | null,"opportunity_id"?: string,"outreach_status"?: Database["public"]['Enums']["outreach_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    }
                  ]
                },"email_events": {
                  Row: {
                    "created_at": string,"id": string,"message_id": string,"opportunity_id": string | null,"outcome": Database["public"]['Enums']["email_outcome"],"previous_stage": Database["public"]['Enums']["application_stage"] | null,"received_at": string,"sender": string,"source": Database["public"]['Enums']["email_source"],"subject": string,"undone_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_id": string,"opportunity_id"?: string | null,"outcome": Database["public"]['Enums']["email_outcome"],"previous_stage"?: Database["public"]['Enums']["application_stage"] | null,"received_at": string,"sender": string,"source": Database["public"]['Enums']["email_source"],"subject": string,"undone_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_id"?: string,"opportunity_id"?: string | null,"outcome"?: Database["public"]['Enums']["email_outcome"],"previous_stage"?: Database["public"]['Enums']["application_stage"] | null,"received_at"?: string,"sender"?: string,"source"?: Database["public"]['Enums']["email_source"],"subject"?: string,"undone_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_events_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    }
                  ]
                },"job_boards": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"url": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"url": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"opportunities": {
                  Row: {
                    "application_stage": Database["public"]['Enums']["application_stage"] | null,"category": Database["public"]['Enums']["opportunity_category"],"company": string,"created_at": string,"date_applied": string | null,"deadline": string | null,"id": string,"linkedin_connection": Database["public"]['Enums']["linkedin_connection"] | null,"location": string | null,"notes": string | null,"posting_notes": string | null,"posting_url": string | null,"priority": Database["public"]['Enums']["priority_level"],"referral_status": Database["public"]['Enums']["referral_status"],"referred_by_contact_id": string | null,"role_title": string | null,"term": string | null,"updated_at": string,"user_id": string,"visa_sponsorship": Database["public"]['Enums']["visa_sponsorship"] | null
                  }
                  Insert: {
                    "application_stage"?: Database["public"]['Enums']["application_stage"] | null,"category": Database["public"]['Enums']["opportunity_category"],"company": string,"created_at"?: string,"date_applied"?: string | null,"deadline"?: string | null,"id"?: string,"linkedin_connection"?: Database["public"]['Enums']["linkedin_connection"] | null,"location"?: string | null,"notes"?: string | null,"posting_notes"?: string | null,"posting_url"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"referral_status"?: Database["public"]['Enums']["referral_status"],"referred_by_contact_id"?: string | null,"role_title"?: string | null,"term"?: string | null,"updated_at"?: string,"user_id"?: string,"visa_sponsorship"?: Database["public"]['Enums']["visa_sponsorship"] | null
                  }
                  Update: {
                    "application_stage"?: Database["public"]['Enums']["application_stage"] | null,"category"?: Database["public"]['Enums']["opportunity_category"],"company"?: string,"created_at"?: string,"date_applied"?: string | null,"deadline"?: string | null,"id"?: string,"linkedin_connection"?: Database["public"]['Enums']["linkedin_connection"] | null,"location"?: string | null,"notes"?: string | null,"posting_notes"?: string | null,"posting_url"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"referral_status"?: Database["public"]['Enums']["referral_status"],"referred_by_contact_id"?: string | null,"role_title"?: string | null,"term"?: string | null,"updated_at"?: string,"user_id"?: string,"visa_sponsorship"?: Database["public"]['Enums']["visa_sponsorship"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_referred_by_contact_fkey"
      columns: ["referred_by_contact_id","id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","opportunity_id"]
    }
                  ]
                },"opportunity_tags": {
                  Row: {
                    "opportunity_id": string,"tag_id": string,"user_id": string
                  }
                  Insert: {
                    "opportunity_id": string,"tag_id": string,"user_id"?: string
                  }
                  Update: {
                    "opportunity_id"?: string,"tag_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_tags_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "color": Database["public"]['Enums']["tag_color"],"created_at": string,"id": string,"name": string,"user_id": string
                  }
                  Insert: {
                    "color"?: Database["public"]['Enums']["tag_color"],"created_at"?: string,"id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "color"?: Database["public"]['Enums']["tag_color"],"created_at"?: string,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "email_connection_delete":
{ Args: { "p_id": string }; Returns: boolean
                           },"email_connection_list":
{ Args: Record<PropertyKey, never>; Returns: { "account_email": string,"created_at": string,"id": string,"last_error": string | null,"last_synced_at": string | null }[]
                           },"email_connection_save":
{ Args: { "p_account_email": string,"p_refresh_token_enc": string }; Returns: undefined
                           },"email_sync_applied":
{ Args: { "p_token"?: string }; Returns: { "application_stage": Database["public"]['Enums']["application_stage"] | null,"company": string,"date_applied": string | null,"id": string,"role_title": string | null }[]
                           },"email_sync_connections":
{ Args: { "p_token"?: string }; Returns: { "account_email": string,"id": string,"last_synced_at": string | null,"refresh_token_enc": string }[]
                           },"email_sync_record":
{ Args: { "p_message_id": string,"p_opportunity_id"?: string,"p_outcome": Database["public"]['Enums']["email_outcome"],"p_received_at": string,"p_sender": string,"p_source": Database["public"]['Enums']["email_source"],"p_subject": string,"p_token"?: string }; Returns: Database["public"]['Enums']["email_outcome"] | null
                           },"email_sync_token_create":
{ Args: Record<PropertyKey, never>; Returns: string
                           },"email_sync_token_created_at":
{ Args: Record<PropertyKey, never>; Returns: string | null
                           },"email_sync_token_delete":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },"email_sync_update_connection":
{ Args: { "p_error"?: string,"p_id": string,"p_refresh_token_enc"?: string,"p_synced_at"?: string,"p_token"?: string }; Returns: undefined
                           },"email_undo_rejection":
{ Args: { "p_event_id": string }; Returns: boolean
                           },"seed_default_tags":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "application_stage": "submitted"|"online_assessment"|"interviewing"|"offer"|"rejected"|"withdrawn","email_outcome": "rejected"|"unmatched"|"ambiguous"|"skipped","email_source": "gmail"|"microsoft","linkedin_connection": "not_sent"|"sent","opportunity_category": "applied"|"planning"|"interested","outreach_status": "not_sent"|"sent"|"read"|"replied","priority_level": "low"|"medium"|"high","referral_status": "not_requested"|"requested"|"received"|"declined","tag_color": "terracotta"|"sage"|"amber"|"slate"|"plum"|"teal","visa_sponsorship": "no"|"maybe"|"highly_likely"|"yes"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "application_stage": ["submitted", "online_assessment", "interviewing", "offer", "rejected", "withdrawn"],"email_outcome": ["rejected", "unmatched", "ambiguous", "skipped"],"email_source": ["gmail", "microsoft"],"linkedin_connection": ["not_sent", "sent"],"opportunity_category": ["applied", "planning", "interested"],"outreach_status": ["not_sent", "sent", "read", "replied"],"priority_level": ["low", "medium", "high"],"referral_status": ["not_requested", "requested", "received", "declined"],"tag_color": ["terracotta", "sage", "amber", "slate", "plum", "teal"],"visa_sponsorship": ["no", "maybe", "highly_likely", "yes"]
          }
        }
} as const
