export type AgentLanguage = 'en' | 'am';

export type AgentHistoryMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type CreateTaskInput = {
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueAt: string | null;
};

export type ScheduleMeetingInput = {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingUrl: string | null;
  attendeeEmails: string[];
};

export type CancelMeetingInput = {
  meetingId: string;
  title: string;
  startsAt: string;
  reason: string | null;
};

export type SendEmailInput = {
  draftId: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  bodyPreview: string;
  contentHash: string;
};

export type ProposedAgentAction =
  | {
      id: string;
      type: 'create_task';
      label: string;
      input: CreateTaskInput;
    }
  | {
      id: string;
      type: 'schedule_meeting';
      label: string;
      input: ScheduleMeetingInput;
    }
  | {
      id: string;
      type: 'cancel_meeting';
      label: string;
      input: CancelMeetingInput;
    }
  | {
      id: string;
      type: 'send_email';
      label: string;
      input: SendEmailInput;
    };

export type AgentClientAction =
  | {
      type: 'task_created';
      task: {
        id: string;
        title: string;
        priority: CreateTaskInput['priority'];
        dueAt: string | null;
      };
    }
  | {
      type: 'meeting_created';
      meeting: {
        id: string;
        title: string;
        startsAt: string;
        endsAt: string;
        location: string | null;
        attendeeEmails: string[];
      };
    }
  | {
      type: 'meeting_cancelled';
      meetingId: string;
    }
  | {
      type: 'email_sent';
      draftId: string;
      sentAt: string;
    };

export type AgentRequest = {
  message?: string;
  language?: AgentLanguage;
  history?: AgentHistoryMessage[];
  approval?: ProposedAgentAction;
};

export type AgentReply = {
  message: string;
  mode: 'demo' | 'agent';
  proposal?: ProposedAgentAction;
  clientAction?: AgentClientAction;
};
