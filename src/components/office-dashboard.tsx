"use client";

import {
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Command,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  Mail,
  Menu,
  Mic,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import type { AgentReply, ProposedAgentAction } from "@/types/agent";
import type { DocumentRecordDTO } from "@/types/documents";
import type { EmailDraftDTO } from "@/types/emails";
import type { MeetingRecordDTO } from "@/types/meetings";
import type { TaskRecordDTO } from "@/types/tasks";

type Language = "en" | "am";
type NavId = "home" | "tasks" | "calendar" | "outbox" | "documents" | "team";

type Task = {
  id: string;
  title: string;
  titleAm: string;
  project: string;
  due: string;
  priority: "high" | "medium" | "low";
  done: boolean;
  assignees: string[];
};

type DashboardWorkspace = {
  mode: "demo" | "supabase";
  name: string;
  role: "owner" | "manager" | "employee";
  userId: string;
  userName: string;
  userInitials: string;
  timezone: string;
};

type OfficeDashboardProps = {
  initialNow: string;
  workspace?: DashboardWorkspace;
  initialTaskRecords?: TaskRecordDTO[];
  initialMeetingRecords?: MeetingRecordDTO[];
  initialDocumentRecords?: DocumentRecordDTO[];
  initialEmailRecords?: EmailDraftDTO[];
};

const demoWorkspace: DashboardWorkspace = {
  mode: "demo",
  name: "Meron Trading PLC",
  role: "owner",
  userId: "demo-user",
  userName: "Selam Alemu",
  userInitials: "SA",
  timezone: "Africa/Addis_Ababa",
};

type MeetingDraft = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  meetingUrl: string;
  attendeeEmails: string;
};

type EmailComposerDraft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
};

type AssistantDrawerMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: ProposedAgentAction;
};

type BrowserSpeechRecognitionResultList = {
  readonly length: number;
  readonly [index: number]: {
    readonly length: number;
    readonly [index: number]: { readonly transcript: string };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: BrowserSpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type VoiceCapableWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

type RealtimeVoiceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "fallback"
  | "error";

type RealtimeSessionPayload = {
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  error?: { code?: string; message?: string };
};

type RealtimeServerEvent = {
  type?: string;
  arguments?: string;
  call_id?: string;
  name?: string;
  transcript?: string;
  text?: string;
  error?: { message?: string };
};

class RealtimeConnectionError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RealtimeConnectionError";
    this.status = status;
    this.code = code;
  }
}

const feminineVoiceHints: Record<Language, string[]> = {
  am: ["mekdes", "female", "woman"],
  en: [
    "aria",
    "ava",
    "emma",
    "female",
    "jenny",
    "karen",
    "samantha",
    "sonia",
    "susan",
    "victoria",
    "woman",
    "zira",
  ],
};

const masculineVoiceHints = ["ameha", "david", "guy", "male", "mark"];

function selectMunaVoice(
  voices: SpeechSynthesisVoice[],
  language: Language,
) {
  const locale = language === "am" ? "am-et" : "en-us";
  const languageCode = locale.split("-")[0];
  const matchingVoices = voices.filter((voice) => {
    const voiceLocale = voice.lang.toLocaleLowerCase().replace("_", "-");
    return voiceLocale === locale || voiceLocale.startsWith(languageCode + "-");
  });

  return [...matchingVoices]
    .filter((voice) => {
      const name = (voice.name + " " + voice.voiceURI).toLocaleLowerCase();
      return !masculineVoiceHints.some((hint) => name.includes(hint));
    })
    .sort((left, right) => {
      const score = (voice: SpeechSynthesisVoice) => {
        const name = (voice.name + " " + voice.voiceURI).toLocaleLowerCase();
        const voiceLocale = voice.lang.toLocaleLowerCase().replace("_", "-");
        return (
          (voiceLocale === locale ? 100 : 60) +
          (feminineVoiceHints[language].some((hint) => name.includes(hint))
            ? 40
            : 0) +
          (voice.default ? 5 : 0)
        );
      };
      return score(right) - score(left);
    })[0];
}

const copy = {
  en: {
    greeting: "Good afternoon",
    subtitle: "Here’s what needs your attention today.",
    search: "Search tasks, people, documents...",
    assistant: "Ask Muna",
    assistantSubtitle: "Your office assistant",
    askAnything: "Ask anything about your work...",
    today: "Today",
    tasks: "tasks",
    meetings: "meetings",
    pending: "pending approvals",
    completed: "completed this week",
    focus: "Today’s focus",
    viewAll: "View all tasks",
    upcoming: "Upcoming meetings",
    schedule: "Schedule meeting",
    activity: "Recent activity",
    quick: "Quick actions",
    addTask: "Add task",
    createTask: "Create a new task",
    taskTitle: "What needs to be done?",
    cancel: "Cancel",
    create: "Create task",
    home: "Home",
    calendar: "Calendar",
    outbox: "Email",
    documents: "Documents",
    team: "People",
    workspace: "Meron Trading PLC",
    todayLabel: "Today",
    noMatches: "No matching tasks found.",
  },
  am: {
    greeting: "እንደምን ዋሉ",
    subtitle: "ዛሬ ትኩረትዎን የሚፈልጉ ሥራዎች እነሆ።",
    search: "ሥራዎችን፣ ሰዎችን፣ ሰነዶችን ይፈልጉ...",
    assistant: "ሙናን ይጠይቁ",
    assistantSubtitle: "የቢሮ ረዳትዎ",
    askAnything: "ስለ ሥራዎ ማንኛውንም ነገር ይጠይቁ...",
    today: "ዛሬ",
    tasks: "ሥራዎች",
    meetings: "ስብሰባዎች",
    pending: "ፈቃድ የሚጠብቁ",
    completed: "በዚህ ሳምንት የተጠናቀቁ",
    focus: "የዛሬ ትኩረት",
    viewAll: "ሁሉንም ሥራዎች ይመልከቱ",
    upcoming: "ቀጣይ ስብሰባዎች",
    schedule: "ስብሰባ ያስይዙ",
    activity: "የቅርብ ጊዜ እንቅስቃሴ",
    quick: "ፈጣን ተግባራት",
    addTask: "ሥራ ጨምር",
    createTask: "አዲስ ሥራ ይፍጠሩ",
    taskTitle: "ምን መሠራት አለበት?",
    cancel: "ይቅር",
    create: "ሥራ ፍጠር",
    home: "መነሻ",
    calendar: "ቀን መቁጠሪያ",
    outbox: "ኢሜይል",
    documents: "ሰነዶች",
    team: "ሰዎች",
    workspace: "ሜሮን ትሬዲንግ ኃ.የተ.የግ.ማ.",
    todayLabel: "ዛሬ",
    noMatches: "የሚዛመድ ሥራ አልተገኘም።",
  },
};

const initialTasks: Task[] = [
  {
    id: "demo-task-1",
    title: "Review Q3 supplier agreements",
    titleAm: "የ3ኛ ሩብ ዓመት የአቅራቢ ውሎችን መከለስ",
    project: "Procurement",
    due: "10:30 AM",
    priority: "high",
    done: false,
    assignees: ["SA", "DA"],
  },
  {
    id: "demo-task-2",
    title: "Approve August payroll",
    titleAm: "የነሐሴ ደመወዝን ማጽደቅ",
    project: "Finance",
    due: "12:00 PM",
    priority: "high",
    done: false,
    assignees: ["SA"],
  },
  {
    id: "demo-task-3",
    title: "Prepare client presentation",
    titleAm: "የደንበኛ ገለጻ ማዘጋጀት",
    project: "Buna Export",
    due: "3:00 PM",
    priority: "medium",
    done: false,
    assignees: ["MK", "SA"],
  },
  {
    id: "demo-task-4",
    title: "Send weekly operations report",
    titleAm: "ሳምንታዊ የሥራ ክንውን ሪፖርት መላክ",
    project: "Operations",
    due: "5:00 PM",
    priority: "low",
    done: true,
    assignees: ["DA"],
  },
];

const activity = [
  { initials: "DA", text: "Dawit uploaded", strong: "August expense report", time: "18 min ago", color: "gold" },
  { initials: "MK", text: "Mekdes completed", strong: "Update product catalogue", time: "42 min ago", color: "purple" },
  { initials: "BT", text: "Betty requested approval", strong: "Office supplies purchase", time: "1 hr ago", color: "teal" },
];

const navItems: { id: NavId; icon: typeof Home; label: keyof typeof copy.en }[] = [
  { id: "home", icon: Home, label: "home" },
  { id: "tasks", icon: CheckCircle2, label: "tasks" },
  { id: "calendar", icon: CalendarDays, label: "calendar" },
  { id: "outbox", icon: Mail, label: "outbox" },
  { id: "documents", icon: FileText, label: "documents" },
  { id: "team", icon: Users, label: "team" },
];

function formatEthiopianDate(language: Language, referenceTime: string) {
  try {
    return new Intl.DateTimeFormat(language === "am" ? "am-ET-u-ca-ethiopic" : "en-ET-u-ca-ethiopic", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(referenceTime));
  } catch {
    return new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(referenceTime));
  }
}

function createDemoMeetingRecords(referenceTime: string): MeetingRecordDTO[] {
  const now = new Date(referenceTime).getTime();
  const createMeeting = (
    id: string,
    title: string,
    hoursFromNow: number,
    location: string,
    attendeeEmails: string[],
  ): MeetingRecordDTO => ({
    id,
    title,
    description: null,
    startsAt: new Date(now + hoursFromNow * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(now + (hoursFromNow + 0.5) * 60 * 60 * 1000).toISOString(),
    location,
    meetingUrl: null,
    attendeeEmails,
    organizerId: "demo-user",
    status: "scheduled",
    cancellationReason: null,
  });

  return [
    createMeeting("demo-meeting-1", "Operations stand-up", 1, "Meeting room 2", ["dawit@example.com", "mekdes@example.com"]),
    createMeeting("demo-meeting-2", "Buna Export review", 3, "Google Meet", ["sales@example.com"]),
    createMeeting("demo-meeting-3", "Finance check-in", 5, "Selam's office", ["finance@example.com"]),
  ];
}

function createDemoDocumentRecords(): DocumentRecordDTO[] {
  return [
    {
      id: "demo-document-1",
      name: "Supplier Agreement 2026.txt",
      mimeType: "text/plain",
      sizeBytes: 4_820,
      uploadedBy: "demo-user",
      createdAt: "2026-08-24T09:30:00.000Z",
      status: "ready",
      extractionError: null,
    },
    {
      id: "demo-document-2",
      name: "Employee Leave Policy.md",
      mimeType: "text/markdown",
      sizeBytes: 2_340,
      uploadedBy: "demo-user",
      createdAt: "2026-08-22T12:00:00.000Z",
      status: "ready",
      extractionError: null,
    },
    {
      id: "demo-document-3",
      name: "August Sales Report.csv",
      mimeType: "text/csv",
      sizeBytes: 1_890,
      uploadedBy: "demo-user",
      createdAt: "2026-08-20T14:20:00.000Z",
      status: "ready",
      extractionError: null,
    },
  ];
}

function createDemoEmailRecords(referenceTime: string): EmailDraftDTO[] {
  const createdAt = new Date(
    new Date(referenceTime).getTime() - 35 * 60 * 1000,
  ).toISOString();
  return [
    {
      id: "6b45a340-50cf-45d8-8f26-5fc1eebd9f2c",
      createdBy: "demo-user",
      toEmails: ["supplier@example.com"],
      ccEmails: [],
      bccEmails: [],
      subject: "Updated delivery schedule",
      bodyText:
        "Hello,\n\nCould you please confirm the updated delivery schedule for our next shipment?\n\nBest regards,\nSelam",
      status: "draft",
      sentAt: null,
      lastError: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function emptyEmailDraft(): EmailComposerDraft {
  return {
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyText: "",
  };
}

function formatFileSize(size: number | null) {
  if (size === null) return "Unknown size";
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return Math.round(size / 1024) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function formatMeetingInput(isoValue: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoValue));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function defaultMeetingDraft(
  timeZone: string,
  referenceTime = Date.now(),
): MeetingDraft {
  const start = new Date(referenceTime + 60 * 60 * 1000);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    title: "",
    description: "",
    startsAt: formatMeetingInput(start.toISOString(), timeZone),
    endsAt: formatMeetingInput(end.toISOString(), timeZone),
    location: "",
    meetingUrl: "",
    attendeeEmails: "",
  };
}

function localMeetingTimeToIso(value: string, timeZone: string) {
  const timezoneSuffix = ["Africa/Addis_Ababa", "Africa/Nairobi"].includes(timeZone)
    ? "+03:00"
    : "";
  return new Date(`${value}:00${timezoneSuffix}`).toISOString();
}

function meetingClock(meeting: MeetingRecordDTO, language: Language, timeZone: string) {
  const parts = new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(meeting.startsAt));
  return {
    time: parts.filter((part) => part.type === "hour" || part.type === "minute").map((part, index) => index === 1 ? `:${part.value}` : part.value).join(""),
    period: parts.find((part) => part.type === "dayPeriod")?.value || "",
  };
}

function meetingDateKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function taskRecordToDashboardTask(
  task: TaskRecordDTO,
  userInitials: string,
  language: Language,
): Task {
  return {
    id: task.id,
    title: task.title,
    titleAm: task.title,
    project: "General",
    due: task.dueAt
      ? new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(task.dueAt))
      : language === "am" ? "የጊዜ ገደብ የለም" : "No due date",
    priority: task.priority === "urgent" ? "high" : task.priority,
    done: task.status === "done",
    assignees: [userInitials],
  };
}

function agentProposalMeta(
  proposal: ProposedAgentAction,
  language: Language,
  timeZone: string,
) {
  if (proposal.type === "create_task") {
    const due = proposal.input.dueAt
      ? " · " +
        new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        }).format(new Date(proposal.input.dueAt))
      : "";
    return proposal.input.priority + " priority" + due;
  }

  if (proposal.type === "send_email") {
    const recipientCount =
      proposal.input.toEmails.length +
      proposal.input.ccEmails.length +
      proposal.input.bccEmails.length;
    return (
      recipientCount +
      (recipientCount === 1 ? " recipient" : " recipients") +
      " · Review required before external delivery"
    );
  }

  const startsAt = new Intl.DateTimeFormat(
    language === "am" ? "am-ET" : "en-ET",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    },
  ).format(new Date(proposal.input.startsAt));

  if (proposal.type === "schedule_meeting") {
    return (
      startsAt +
      (proposal.input.location ? " · " + proposal.input.location : "") +
      (proposal.input.attendeeEmails.length
        ? " · " + proposal.input.attendeeEmails.length + " attendees"
        : "")
    );
  }

  return (
    (language === "am" ? "ስረዛ · " : "Cancellation · ") +
    startsAt +
    (proposal.input.reason ? " · " + proposal.input.reason : "")
  );
}

function agentProposalTitle(proposal: ProposedAgentAction) {
  return proposal.type === "send_email"
    ? proposal.input.subject
    : proposal.input.title;
}

function agentProposalButton(
  proposal: ProposedAgentAction,
  language: Language,
) {
  if (proposal.type === "create_task") {
    return language === "am"
      ? "ፍቀድ እና ሥራውን ፍጠር"
      : "Approve & create task";
  }
  if (proposal.type === "schedule_meeting") {
    return language === "am"
      ? "ፍቀድ እና ስብሰባውን አስይዝ"
      : "Approve & schedule";
  }
  if (proposal.type === "send_email") {
    return language === "am"
      ? "አረጋግጥ እና ኢሜይሉን ላክ"
      : "Approve & send email";
  }
  return language === "am"
    ? "ፍቀድ እና ስብሰባውን ሰርዝ"
    : "Approve cancellation";
}

export default function OfficeDashboard({
  initialNow,
  workspace = demoWorkspace,
  initialTaskRecords,
  initialMeetingRecords,
  initialDocumentRecords,
  initialEmailRecords,
}: OfficeDashboardProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("en");
  const [activeNav, setActiveNav] = useState<NavId>("home");
  const [tasks, setTasks] = useState<Task[]>(() =>
    initialTaskRecords
      ? initialTaskRecords.map((task) =>
          taskRecordToDashboardTask(task, workspace.userInitials, "en"),
        )
      : initialTasks,
  );
  const [meetings, setMeetings] = useState<MeetingRecordDTO[]>(() =>
    initialMeetingRecords || createDemoMeetingRecords(initialNow),
  );
  const [documents, setDocuments] = useState<DocumentRecordDTO[]>(() =>
    initialDocumentRecords || createDemoDocumentRecords(),
  );
  const [emails, setEmails] = useState<EmailDraftDTO[]>(() =>
    initialEmailRecords || createDemoEmailRecords(initialNow),
  );
  const [query, setQuery] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantDrawerMessage[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeakingId, setVoiceSpeakingId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [voiceProfileName, setVoiceProfileName] = useState("");
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeVoiceStatus>("idle");
  const [realtimeActivity, setRealtimeActivity] = useState("");
  const [realtimeVoiceName, setRealtimeVoiceName] = useState("");
  const [taskMutationBusy, setTaskMutationBusy] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [meetingModal, setMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingRecordDTO | null>(null);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(() =>
    defaultMeetingDraft(workspace.timezone, new Date(initialNow).getTime()),
  );
  const [meetingCancelConfirm, setMeetingCancelConfirm] = useState(false);
  const [meetingCancellationReason, setMeetingCancellationReason] = useState("");
  const [meetingMutationBusy, setMeetingMutationBusy] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [documentModal, setDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentDeleteTarget, setDocumentDeleteTarget] =
    useState<DocumentRecordDTO | null>(null);
  const [documentMutationBusy, setDocumentMutationBusy] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [emailModal, setEmailModal] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailDraftDTO | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailComposerDraft>(emptyEmailDraft);
  const [emailDeleteTarget, setEmailDeleteTarget] =
    useState<EmailDraftDTO | null>(null);
  const [emailSendProposal, setEmailSendProposal] = useState<
    Extract<ProposedAgentAction, { type: "send_email" }> | null
  >(null);
  const [emailMutationBusy, setEmailMutationBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "employee">("employee");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const storageReady = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceTranscriptRef = useRef("");
  const voiceShouldSubmitRef = useRef(false);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const assistantMessagesRef = useRef<AssistantDrawerMessage[]>([]);
  const realtimePeerRef = useRef<RTCPeerConnection | null>(null);
  const realtimeChannelRef = useRef<RTCDataChannel | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeToolCallsRef = useRef(new Set<string>());
  const browserFallbackReasonRef = useRef("");
  const realtimeRetryAfterRef = useRef(0);
  const t = copy[language];
  const firstName = workspace.userName.split(/\s+/)[0] || workspace.userName;
  const roleLabel = workspace.role === "owner" ? "Company owner" : workspace.role === "manager" ? "Manager" : "Employee";
  const canInvite = workspace.mode === "supabase" && ["owner", "manager"].includes(workspace.role);
  const scheduledMeetings = meetings.filter((meeting) => meeting.status === "scheduled");
  const todayKey = meetingDateKey(initialNow, workspace.timezone);
  const todayMeetings = scheduledMeetings.filter((meeting) => meetingDateKey(meeting.startsAt, workspace.timezone) === todayKey);
  const realtimeVoiceActive =
    realtimeStatus === "connecting" || realtimeStatus === "connected";
  const munaVoiceActive = voiceListening || realtimeVoiceActive;

  useEffect(() => {
    if (workspace.mode !== "demo") {
      storageReady.current = true;
      return;
    }

    const saved = window.localStorage.getItem("muna-tasks");
    const restoreStoredTasks = window.setTimeout(() => {
      if (saved) {
        try {
          setTasks(JSON.parse(saved) as Task[]);
        } catch {
          window.localStorage.removeItem("muna-tasks");
        }
      }
      storageReady.current = true;
    }, 0);

    return () => window.clearTimeout(restoreStoredTasks);
  }, [workspace.mode]);

  useEffect(() => {
    if (!storageReady.current || workspace.mode !== "demo") return;
    window.localStorage.setItem("muna-tasks", JSON.stringify(tasks));
  }, [workspace.mode, tasks]);

  useEffect(() => {
    assistantMessagesRef.current = assistantMessages;
  }, [assistantMessages]);

  useEffect(() => {
    const synthesis = window.speechSynthesis;
    const loadVoices = () => {
      availableVoicesRef.current = synthesis?.getVoices() || [];
    };
    loadVoices();
    synthesis?.addEventListener("voiceschanged", loadVoices);

    return () => {
      voiceShouldSubmitRef.current = false;
      recognitionRef.current?.abort();
      synthesis?.cancel();
      synthesis?.removeEventListener("voiceschanged", loadVoices);
      realtimeChannelRef.current?.close();
      realtimePeerRef.current?.close();
      realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (realtimeAudioRef.current) {
        realtimeAudioRef.current.pause();
        realtimeAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.titleAm} ${task.project}`.toLowerCase().includes(normalized),
    );
  }, [query, tasks]);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return documents;
    return documents.filter((document) =>
      document.name.toLocaleLowerCase().includes(normalized),
    );
  }, [documents, query]);

  const visibleEmails = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return emails;
    return emails.filter((email) =>
      [
        email.subject,
        email.bodyText,
        ...email.toEmails,
        ...email.ccEmails,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [emails, query]);

  const incomplete = tasks.filter((task) => !task.done).length;
  const completed = tasks.filter((task) => task.done).length;

  async function toggleTask(id: string) {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask || taskMutationBusy) return;

    const done = !currentTask.done;
    setTaskError("");
    setTasks((items) => items.map((task) => (task.id === id ? { ...task, done } : task)));
    if (workspace.mode === "demo") return;

    setTaskMutationBusy(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
      if (!response.ok) throw new Error("The task could not be updated.");
    } catch (error) {
      setTasks((items) => items.map((task) => (task.id === id ? currentTask : task)));
      setTaskError(error instanceof Error ? error.message : "The task could not be updated.");
    } finally {
      setTaskMutationBusy(false);
    }
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || taskMutationBusy) return;

    if (workspace.mode === "demo") {
      setTasks((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          title,
          titleAm: title,
          project: "General",
          due: t.todayLabel,
          priority: "medium",
          done: false,
          assignees: [workspace.userInitials],
        },
      ]);
      setNewTask("");
      setTaskModal(false);
      return;
    }

    setTaskMutationBusy(true);
    setTaskError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: null, priority: "medium", dueAt: null }),
      });
      const payload = (await response.json()) as { task?: TaskRecordDTO };
      if (!response.ok || !payload.task) throw new Error("The task could not be created.");
      setTasks((items) => [
        ...items,
        taskRecordToDashboardTask(payload.task!, workspace.userInitials, language),
      ]);
      setNewTask("");
      setTaskModal(false);
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : "The task could not be created.");
    } finally {
      setTaskMutationBusy(false);
    }
  }

  function openMeetingForm(meeting?: MeetingRecordDTO) {
    setMeetingError("");
    setMeetingCancelConfirm(false);
    setMeetingCancellationReason("");
    setEditingMeeting(meeting || null);
    setMeetingDraft(
      meeting
        ? {
            title: meeting.title,
            description: meeting.description || "",
            startsAt: formatMeetingInput(meeting.startsAt, workspace.timezone),
            endsAt: formatMeetingInput(meeting.endsAt, workspace.timezone),
            location: meeting.location || "",
            meetingUrl: meeting.meetingUrl || "",
            attendeeEmails: meeting.attendeeEmails.join(", "),
          }
        : defaultMeetingDraft(workspace.timezone),
    );
    setMeetingModal(true);
  }

  function normalizedAttendeeEmails(value: string) {
    return Array.from(
      new Set(
        value
          .split(/[,;\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  async function submitMeeting(event: FormEvent) {
    event.preventDefault();
    if (!meetingDraft.title.trim() || meetingMutationBusy) return;

    let startsAt: string;
    let endsAt: string;
    try {
      startsAt = localMeetingTimeToIso(meetingDraft.startsAt, workspace.timezone);
      endsAt = localMeetingTimeToIso(meetingDraft.endsAt, workspace.timezone);
    } catch {
      setMeetingError("Enter a valid meeting date and time.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setMeetingError("Meeting end time must be after its start time.");
      return;
    }

    const input = {
      title: meetingDraft.title.trim(),
      description: meetingDraft.description.trim() || null,
      startsAt,
      endsAt,
      location: meetingDraft.location.trim() || null,
      meetingUrl: meetingDraft.meetingUrl.trim() || null,
      attendeeEmails: normalizedAttendeeEmails(meetingDraft.attendeeEmails),
    };
    setMeetingMutationBusy(true);
    setMeetingError("");

    try {
      let meeting: MeetingRecordDTO;
      if (workspace.mode === "demo") {
        meeting = editingMeeting
          ? { ...editingMeeting, ...input }
          : {
              id: crypto.randomUUID(),
              ...input,
              organizerId: workspace.userId,
              status: "scheduled",
              cancellationReason: null,
            };
      } else {
        const response = await fetch("/api/meetings", {
          method: editingMeeting ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingMeeting ? { id: editingMeeting.id, ...input } : input),
        });
        const payload = (await response.json()) as {
          meeting?: MeetingRecordDTO;
          error?: { message?: string };
        };
        if (!response.ok || !payload.meeting) {
          throw new Error(payload.error?.message || "The meeting could not be saved.");
        }
        meeting = payload.meeting;
      }

      setMeetings((items) =>
        [...items.filter((item) => item.id !== meeting.id), meeting].sort(
          (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
      );
      setMeetingModal(false);
      setEditingMeeting(null);
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "The meeting could not be saved.");
    } finally {
      setMeetingMutationBusy(false);
    }
  }

  async function confirmMeetingCancellation() {
    if (!editingMeeting || meetingMutationBusy) return;
    setMeetingMutationBusy(true);
    setMeetingError("");

    try {
      if (workspace.mode !== "demo") {
        const response = await fetch("/api/meetings", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMeeting.id,
            reason: meetingCancellationReason.trim() || null,
          }),
        });
        const payload = (await response.json()) as { error?: { message?: string } };
        if (!response.ok) {
          throw new Error(payload.error?.message || "The meeting could not be cancelled.");
        }
      }

      setMeetings((items) =>
        items.map((meeting) =>
          meeting.id === editingMeeting.id
            ? {
                ...meeting,
                status: "cancelled",
                cancellationReason: meetingCancellationReason.trim() || null,
              }
            : meeting,
        ),
      );
      setMeetingModal(false);
      setEditingMeeting(null);
      setMeetingCancelConfirm(false);
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "The meeting could not be cancelled.");
    } finally {
      setMeetingMutationBusy(false);
    }
  }

  function openDocumentUpload() {
    setSelectedDocument(null);
    setDocumentError("");
    setDocumentModal(true);
  }

  async function submitDocument(event: FormEvent) {
    event.preventDefault();
    if (!selectedDocument || documentMutationBusy) return;

    setDocumentMutationBusy(true);
    setDocumentError("");
    try {
      const formData = new FormData();
      formData.set("file", selectedDocument);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        document?: DocumentRecordDTO;
        error?: { message?: string };
      };
      if (!response.ok || !payload.document) {
        throw new Error(payload.error?.message || "Unable to upload the document.");
      }

      setDocuments((items) => [
        payload.document!,
        ...items.filter((item) => item.id !== payload.document!.id),
      ]);
      setDocumentModal(false);
      setSelectedDocument(null);
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : "Unable to upload the document.",
      );
    } finally {
      setDocumentMutationBusy(false);
    }
  }

  async function confirmDocumentDeletion() {
    if (!documentDeleteTarget || documentMutationBusy) return;

    setDocumentMutationBusy(true);
    setDocumentError("");
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: documentDeleteTarget.id }),
      });
      const payload = (await response.json()) as {
        deleted?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.deleted) {
        throw new Error(payload.error?.message || "Unable to delete the document.");
      }

      setDocuments((items) =>
        items.filter((document) => document.id !== documentDeleteTarget.id),
      );
      setDocumentDeleteTarget(null);
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : "Unable to delete the document.",
      );
    } finally {
      setDocumentMutationBusy(false);
    }
  }

  function parseEmailAddresses(value: string) {
    return Array.from(
      new Set(
        value
          .split(/[,;\n]/)
          .map((address) => address.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  function openEmailComposer(email?: EmailDraftDTO) {
    setEmailError("");
    setEmailNotice("");
    setEmailSendProposal(null);
    setEditingEmail(email || null);
    setEmailDraft(
      email
        ? {
            to: email.toEmails.join(", "),
            cc: email.ccEmails.join(", "),
            bcc: email.bccEmails.join(", "),
            subject: email.subject,
            bodyText: email.bodyText,
          }
        : emptyEmailDraft(),
    );
    setEmailModal(true);
  }

  async function refreshEmails(reportError = false) {
    try {
      const response = await fetch("/api/emails");
      const payload = (await response.json()) as {
        emails?: EmailDraftDTO[];
        error?: { message?: string };
      };
      if (!response.ok || !payload.emails) {
        throw new Error(payload.error?.message || "Unable to refresh the outbox.");
      }
      setEmails(payload.emails);
    } catch (error) {
      if (reportError) {
        setEmailError(
          error instanceof Error ? error.message : "Unable to refresh the outbox.",
        );
      }
    }
  }

  async function submitEmailDraft(event: FormEvent) {
    event.preventDefault();
    if (
      emailMutationBusy ||
      !emailDraft.to.trim() ||
      !emailDraft.subject.trim() ||
      !emailDraft.bodyText.trim()
    ) {
      return;
    }

    const input = {
      toEmails: parseEmailAddresses(emailDraft.to),
      ccEmails: parseEmailAddresses(emailDraft.cc),
      bccEmails: parseEmailAddresses(emailDraft.bcc),
      subject: emailDraft.subject.trim(),
      bodyText: emailDraft.bodyText.trim(),
    };
    setEmailMutationBusy(true);
    setEmailError("");
    setEmailNotice("");

    try {
      const response = await fetch("/api/emails", {
        method: editingEmail ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingEmail ? { id: editingEmail.id, input } : input,
        ),
      });
      const payload = (await response.json()) as {
        email?: EmailDraftDTO;
        error?: { message?: string };
      };
      if (!response.ok || !payload.email) {
        throw new Error(payload.error?.message || "Unable to save the email draft.");
      }
      setEmails((items) => [
        payload.email!,
        ...items.filter((email) => email.id !== payload.email!.id),
      ]);
      setEmailModal(false);
      setEditingEmail(null);
      setEmailNotice(
        language === "am"
          ? "ረቂቁ ተቀምጧል። ምንም ኢሜይል አልተላከም።"
          : "Draft saved. No email has been sent.",
      );
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "Unable to save the email draft.",
      );
    } finally {
      setEmailMutationBusy(false);
    }
  }

  async function confirmEmailDeletion() {
    if (!emailDeleteTarget || emailMutationBusy) return;
    setEmailMutationBusy(true);
    setEmailError("");
    setEmailNotice("");

    try {
      const response = await fetch("/api/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emailDeleteTarget.id }),
      });
      const payload = (await response.json()) as {
        deleted?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.deleted) {
        throw new Error(payload.error?.message || "Unable to delete the email draft.");
      }
      setEmails((items) =>
        items.filter((email) => email.id !== emailDeleteTarget.id),
      );
      setEmailDeleteTarget(null);
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "Unable to delete the email draft.",
      );
    } finally {
      setEmailMutationBusy(false);
    }
  }

  async function prepareEmailSend(email: EmailDraftDTO) {
    if (emailMutationBusy) return;
    setEmailMutationBusy(true);
    setEmailError("");
    setEmailNotice("");
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", draftId: email.id }),
      });
      const payload = (await response.json()) as {
        proposal?: Extract<ProposedAgentAction, { type: "send_email" }>;
        error?: { message?: string };
      };
      if (!response.ok || !payload.proposal) {
        throw new Error(payload.error?.message || "Unable to prepare this email.");
      }
      setEmailSendProposal(payload.proposal);
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "Unable to prepare this email.",
      );
    } finally {
      setEmailMutationBusy(false);
    }
  }

  async function approveEmailSend() {
    if (!emailSendProposal || emailMutationBusy) return;
    setEmailMutationBusy(true);
    setEmailError("");
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          approval: emailSendProposal,
        }),
      });
      const payload = (await response.json()) as {
        email?: EmailDraftDTO;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.email) {
        throw new Error(payload.error?.message || "Unable to send the email.");
      }
      setEmails((items) =>
        items.map((email) =>
          email.id === payload.email!.id ? payload.email! : email,
        ),
      );
      setEmailNotice(payload.message || "The email was sent.");
      setEmailSendProposal(null);
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "Unable to send the email.",
      );
      setEmailSendProposal(null);
      await refreshEmails();
    } finally {
      setEmailMutationBusy(false);
    }
  }

  async function submitInvitation(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim() || inviteBusy) return;
    setInviteBusy(true);
    setInviteError("");
    setInviteCode("");

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const payload = (await response.json()) as {
        code?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.code) {
        throw new Error(payload.error?.message || "The invitation could not be created.");
      }
      setInviteCode(payload.code);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "The invitation could not be created.");
    } finally {
      setInviteBusy(false);
    }
  }

  function stopVoiceOutput() {
    window.speechSynthesis?.cancel();
    setVoiceSpeakingId(null);
  }

  function switchLanguage(nextLanguage: Language) {
    stopRealtimeVoice();
    voiceShouldSubmitRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceListening(false);
    stopVoiceOutput();
    setVoiceError("");
    setVoiceProfileName("");
    setLanguage(nextLanguage);
  }

  function speakAssistantMessage(text: string, messageId: string) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setVoiceError(
        language === "am"
          ? "ይህ አሳሽ የድምፅ መልስን አይደግፍም።"
          : "Spoken replies are not supported in this browser.",
      );
      return;
    }

    if (voiceSpeakingId === messageId) {
      stopVoiceOutput();
      return;
    }

    window.speechSynthesis.cancel();
    const speechLanguage: Language = /[\u1200-\u137f]/.test(text) ? "am" : language;
    const voice =
      selectMunaVoice(availableVoicesRef.current, speechLanguage) ||
      selectMunaVoice(window.speechSynthesis.getVoices(), speechLanguage);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage === "am" ? "am-ET" : "en-US";
    if (voice) utterance.voice = voice;
    utterance.pitch = voice ? 1 : 1.06;
    utterance.rate = 0.98;
    utterance.onend = () =>
      setVoiceSpeakingId((current) => (current === messageId ? null : current));
    utterance.onerror = () => {
      setVoiceSpeakingId((current) => (current === messageId ? null : current));
      setVoiceError(
        language === "am"
          ? "የሙናን ድምፅ ማጫወት አልተቻለም።"
          : "Muna could not play the spoken reply.",
      );
    };

    setVoiceProfileName(
      voice?.name ||
        (speechLanguage === "am"
          ? "Browser Amharic fallback"
          : "Browser voice fallback"),
    );
    setVoiceError(
      speechLanguage === "am" && !voice
        ? "የአማርኛ የሴት ድምፅ በዚህ መሣሪያ አልተገኘም። ሙና የአሳሹን ድምፅ ትጠቀማለች።"
        : "",
    );
    setVoiceSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  }

  async function sendAgentRequest(
    message: string,
    speakReply = false,
  ): Promise<AgentReply | null> {
    const userMessage: AssistantDrawerMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: message,
    };
    const history = assistantMessagesRef.current.map(({ role, text }) => ({
      role,
      text,
    }));

    setAssistantMessages((messages) => [...messages, userMessage]);
    setAssistantBusy(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, language, history }),
      });
      const payload = (await response.json()) as AgentReply | {
        error?: { message?: string };
      };

      if (!response.ok || !("message" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error?.message || "Muna could not answer that request."
            : "Muna could not answer that request.",
        );
      }

      const assistantMessageId = crypto.randomUUID();
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: assistantMessageId,
          role: "assistant",
          text: payload.message,
          proposal: payload.proposal,
        },
      ]);
      if (speakReply) speakAssistantMessage(payload.message, assistantMessageId);
      void refreshEmails();
      return payload;
    } catch (error) {
      const assistantMessageId = crypto.randomUUID();
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Muna could not answer that request.";
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: assistantMessageId,
          role: "assistant",
          text: errorMessage,
        },
      ]);
      if (speakReply) speakAssistantMessage(errorMessage, assistantMessageId);
      return null;
    } finally {
      setAssistantBusy(false);
    }
  }

  function releaseRealtimeResources() {
    const channel = realtimeChannelRef.current;
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.close();
    }
    realtimeChannelRef.current = null;

    const peer = realtimePeerRef.current;
    if (peer) {
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    realtimePeerRef.current = null;

    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
    realtimeStreamRef.current = null;

    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
    }
    realtimeAudioRef.current = null;
    realtimeToolCallsRef.current.clear();
  }

  function stopRealtimeVoice() {
    releaseRealtimeResources();
    browserFallbackReasonRef.current = "";
    realtimeRetryAfterRef.current = 0;
    setRealtimeStatus("idle");
    setRealtimeActivity("");
    setRealtimeVoiceName("");
    setVoiceError("");
  }

  function sendRealtimeEvent(
    channel: RTCDataChannel,
    event: Record<string, unknown>,
  ) {
    if (channel.readyState === "open") {
      channel.send(JSON.stringify(event));
    }
  }

  async function handleRealtimeToolCall(
    event: RealtimeServerEvent,
    channel: RTCDataChannel,
  ) {
    if (
      event.name !== "use_office_agent" ||
      !event.call_id ||
      realtimeToolCallsRef.current.has(event.call_id)
    ) {
      return;
    }
    realtimeToolCallsRef.current.add(event.call_id);

    let message = "";
    try {
      const parsedArguments = JSON.parse(event.arguments || "{}") as {
        message?: unknown;
      };
      if (typeof parsedArguments.message === "string") {
        message = parsedArguments.message.trim();
      }
    } catch {
      message = "";
    }

    setRealtimeActivity(
      language === "am"
        ? "ሙና የቢሮ መረጃውን እየፈተሸች ነው…"
        : "Muna is checking your office workspace…",
    );

    const reply = message
      ? await sendAgentRequest(message, false)
      : null;
    const resultMessage =
      reply?.message ||
      (language === "am"
        ? "ጥያቄውን መረዳት አልቻልኩም። እባክዎ እንደገና ይናገሩ።"
        : "I could not understand that request. Please say it again.");

    sendRealtimeEvent(channel, {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: event.call_id,
        output: JSON.stringify({
          message: resultMessage,
          requiresApproval: Boolean(reply?.proposal),
          proposalType: reply?.proposal?.type || null,
        }),
      },
    });
    sendRealtimeEvent(channel, {
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        tool_choice: "none",
        instructions:
          language === "am"
            ? "የቢሮ ወኪሉን ውጤት በተፈጥሯዊ አማርኛ የሴት ድምፅ በአጭሩ ተናገሪ። ፈቃድ ካስፈለገ በማያ ገጹ ላይ ያለውን የፈቃድ ካርድ እንዲጫኑ ንገሪያቸው። ሌላ መሣሪያ አትጥሪ።"
            : "Speak the office agent result briefly in natural English with Muna's warm feminine character. If approval is required, tell the user to use the approval card on screen. Do not call another tool.",
      },
    });
  }

  function handleRealtimeEvent(
    event: RealtimeServerEvent,
    channel: RTCDataChannel,
  ) {
    if (event.type === "session.created") {
      setRealtimeStatus("connected");
      setRealtimeActivity(
        language === "am"
          ? "የቀጥታ ድምፅ ተገናኝቷል። በአማርኛ ይናገሩ።"
          : "Live voice connected. Speak naturally.",
      );
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      setVoiceError("");
      setRealtimeActivity(
        language === "am"
          ? "ሙና እየሰማች ነው…"
          : "Muna is listening…",
      );
      return;
    }

    if (
      event.type ===
      "conversation.item.input_audio_transcription.completed"
    ) {
      setRealtimeActivity(
        event.transcript
          ? (language === "am" ? "የተሰማው፦ " : "Heard: ") + event.transcript
          : language === "am"
            ? "ሙና ጥያቄውን እያዘጋጀች ነው…"
            : "Muna is preparing your request…",
      );
      return;
    }

    if (event.type === "response.function_call_arguments.done") {
      void handleRealtimeToolCall(event, channel);
      return;
    }

    if (
      event.type === "response.output_audio_transcript.done" ||
      event.type === "response.output_text.done"
    ) {
      setRealtimeActivity(
        language === "am" ? "ሙና እየተናገረች ነው…" : "Muna is speaking…",
      );
      return;
    }

    if (event.type === "response.done") {
      setRealtimeActivity(
        language === "am"
          ? "የቀጥታ ድምፅ ዝግጁ ነው።"
          : "Live voice is ready.",
      );
      return;
    }

    if (event.type === "error") {
      setVoiceError(
        event.error?.message ||
          (language === "am"
            ? "በቀጥታ ድምፅ ግንኙነቱ ላይ ስህተት ተፈጥሯል።"
            : "The live voice session reported an error."),
      );
    }
  }

  async function startRealtimeVoice() {
    if (Date.now() < realtimeRetryAfterRef.current) {
      setRealtimeStatus("fallback");
      setRealtimeActivity(
        browserFallbackReasonRef.current ||
          (language === "am"
            ? "የአሳሽ ድምፅ ሁነታን በመጠቀም ላይ…"
            : "Using browser voice fallback…"),
      );
      toggleVoiceListening();
      return;
    }

    if (
      typeof RTCPeerConnection === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      browserFallbackReasonRef.current =
        language === "am"
          ? "Realtime በዚህ አሳሽ አይገኝም፤ የአሳሽ ድምፅ በመጠቀም ላይ…"
          : "Realtime is unavailable in this browser; using browser voice…";
      setRealtimeStatus("fallback");
      setRealtimeActivity(browserFallbackReasonRef.current);
      toggleVoiceListening();
      return;
    }

    releaseRealtimeResources();
    browserFallbackReasonRef.current = "";
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopVoiceOutput();
    setVoiceError("");
    setRealtimeStatus("connecting");
    setRealtimeActivity(
      language === "am"
        ? "ሙና የቀጥታ ድምፅን እያገናኘች ነው…"
        : "Connecting Muna's live voice…",
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      realtimeStreamRef.current = stream;

      const sessionResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const session = (await sessionResponse.json()) as RealtimeSessionPayload;

      if (
        session.error?.code === "REALTIME_NOT_CONFIGURED" ||
        !session.clientSecret
      ) {
        if (
          session.error?.code === "REALTIME_NOT_CONFIGURED"
        ) {
          releaseRealtimeResources();
          browserFallbackReasonRef.current =
            language === "am"
              ? "Realtime ቁልፍ አልተዋቀረም፤ የአሳሽ ድምፅ በመጠቀም ላይ…"
              : "Realtime is not configured; using browser voice…";
          setRealtimeStatus("fallback");
          setRealtimeActivity(browserFallbackReasonRef.current);
          toggleVoiceListening();
          return;
        }
        throw new Error(
          session.error?.message ||
            "Muna could not create a live voice session.",
        );
      }

      const peer = new RTCPeerConnection();
      realtimePeerRef.current = peer;
      const audio = new Audio();
      audio.autoplay = true;
      realtimeAudioRef.current = audio;

      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => undefined);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          releaseRealtimeResources();
          setRealtimeStatus("error");
          setVoiceError(
            language === "am"
              ? "የሙና የቀጥታ ድምፅ ግንኙነት ተቋርጧል።"
              : "Muna's live voice connection failed.",
          );
        }
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const channel = peer.createDataChannel("oai-events");
      realtimeChannelRef.current = channel;
      channel.onopen = () => {
        setRealtimeStatus("connected");
        setRealtimeVoiceName(session.voice || "marin");
        setVoiceProfileName((session.voice || "marin") + " · Realtime");
        setRealtimeActivity(
          language === "am"
            ? "የቀጥታ ድምፅ ተገናኝቷል። በአማርኛ ይናገሩ።"
            : "Live voice connected. Speak naturally.",
        );
      };
      channel.onmessage = (messageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data as string) as RealtimeServerEvent;
          handleRealtimeEvent(event, channel);
        } catch {
          setVoiceError(
            language === "am"
              ? "ከቀጥታ ድምፅ የመጣውን መልዕክት ማንበብ አልተቻለም።"
              : "Muna could not read a live voice event.",
          );
        }
      };
      channel.onclose = () => {
        if (realtimeChannelRef.current === channel) {
          releaseRealtimeResources();
          setRealtimeStatus("idle");
          setRealtimeActivity("");
        }
      };
      channel.onerror = () => {
        setVoiceError(
          language === "am"
            ? "የቀጥታ ድምፅ የመረጃ ግንኙነት ተቋርጧል።"
            : "Muna's live voice data connection failed.",
        );
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) {
        throw new Error("The browser could not create a voice connection.");
      }

      const model = session.model || "gpt-realtime-2";
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls?model=" +
          encodeURIComponent(model),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + session.clientSecret,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );
      const sdpBody = await sdpResponse.text();
      if (!sdpResponse.ok) {
        let upstreamCode: string | undefined;
        let upstreamMessage = "";
        try {
          const upstream = JSON.parse(sdpBody) as {
            error?: { code?: string; message?: string };
          };
          upstreamCode = upstream.error?.code;
          upstreamMessage = upstream.error?.message || "";
        } catch {
          upstreamMessage = "";
        }
        throw new RealtimeConnectionError(
          upstreamMessage ||
            "OpenAI could not establish Muna's live voice connection.",
          sdpResponse.status,
          upstreamCode,
        );
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: sdpBody,
      });
    } catch (error) {
      releaseRealtimeResources();
      if (error instanceof RealtimeConnectionError && error.status === 429) {
        const quotaUnavailable =
          error.code === "insufficient_quota" ||
          error.code === "credit_balance_exhausted" ||
          error.code === "organization_spend_limit_exceeded" ||
          error.code === "project_spend_limit_exceeded";
        browserFallbackReasonRef.current = quotaUnavailable
          ? language === "am"
            ? "የOpenAI API ክሬዲት ወይም የወጪ ገደብ ደርሷል፤ ሙና የአሳሽ ድምፅን ትጠቀማለች።"
            : "OpenAI API credit or spend quota is unavailable; Muna is using browser voice."
          : language === "am"
            ? "የOpenAI Realtime ገደብ ደርሷል፤ ሙና የአሳሽ ድምፅን ትጠቀማለች።"
            : "OpenAI Realtime is rate-limited; Muna is using browser voice.";
        realtimeRetryAfterRef.current = Date.now() + 60_000;
        setRealtimeStatus("fallback");
        setRealtimeActivity(browserFallbackReasonRef.current);
        setVoiceError("");
        toggleVoiceListening();
        return;
      }
      setRealtimeStatus("error");
      setRealtimeActivity("");
      setVoiceError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? language === "am"
            ? "የማይክሮፎን ፈቃድ አልተሰጠም።"
            : "Microphone permission was denied."
          : error instanceof Error
            ? error.message
            : language === "am"
              ? "የሙናን የቀጥታ ድምፅ ማስጀመር አልተቻለም።"
              : "Muna could not start live voice.",
      );
    }
  }

  function toggleMunaVoice() {
    if (realtimeVoiceActive) {
      stopRealtimeVoice();
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    void startRealtimeVoice();
  }

  function voiceInputErrorMessage(error: string) {
    if (language === "am") {
      if (error === "not-allowed" || error === "service-not-allowed") {
        return "የማይክሮፎን ፈቃድ አልተሰጠም። በአሳሽዎ ቅንብር ፈቃድ ይስጡ።";
      }
      if (error === "no-speech") return "ድምፅ አልተሰማም። እንደገና ይሞክሩ።";
      return "የድምፅ ጥያቄውን መቀበል አልተቻለም።";
    }
    if (error === "not-allowed" || error === "service-not-allowed") {
      return "Microphone permission was denied. Allow it in your browser settings and try again.";
    }
    if (error === "no-speech") return "I could not hear you. Please try again.";
    return "Muna could not capture that voice request. Please try again.";
  }

  function toggleVoiceListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const voiceWindow = window as VoiceCapableWindow;
    const SpeechRecognition =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRealtimeStatus("error");
      setRealtimeActivity("");
      setVoiceError(
        language === "am"
          ? "ይህ አሳሽ የድምፅ ጥያቄን አይደግፍም። Edge ወይም Chrome ይጠቀሙ።"
          : "Voice input is unavailable in this browser. Try Edge or Chrome, or type your request.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "am" ? "am-ET" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    voiceTranscriptRef.current = "";
    voiceShouldSubmitRef.current = true;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setVoiceError("");
      setVoiceListening(true);
      setRealtimeStatus("fallback");
      setRealtimeActivity(
        browserFallbackReasonRef.current ||
          (language === "am"
            ? "የአሳሽ ድምፅ፦ ሙና እየሰማች ነው…"
            : "Browser voice: Muna is listening…"),
      );
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript || "";
      }
      voiceTranscriptRef.current = transcript.trim();
      setAssistantText(transcript.trim());
    };
    recognition.onerror = (event) => {
      voiceShouldSubmitRef.current = false;
      setRealtimeStatus("error");
      setRealtimeActivity("");
      if (event.error !== "aborted") setVoiceError(voiceInputErrorMessage(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceListening(false);
      setRealtimeStatus("idle");
      setRealtimeActivity("");
      const transcript = voiceTranscriptRef.current.trim();
      const shouldSubmit = voiceShouldSubmitRef.current;
      voiceTranscriptRef.current = "";
      voiceShouldSubmitRef.current = false;
      if (shouldSubmit && transcript) {
        setAssistantText("");
        void sendAgentRequest(transcript, true);
      }
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      voiceShouldSubmitRef.current = false;
      setVoiceListening(false);
      setRealtimeStatus("error");
      setRealtimeActivity("");
      setVoiceError(voiceInputErrorMessage("start-failed"));
    }
  }

  function closeAssistant() {
    stopRealtimeVoice();
    voiceShouldSubmitRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setVoiceListening(false);
    stopVoiceOutput();
    setAssistantOpen(false);
  }

  async function approveAgentAction(proposal: ProposedAgentAction) {
    setAssistantBusy(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, approval: proposal }),
      });
      const payload = (await response.json()) as AgentReply | {
        error?: { message?: string };
      };

      if (!response.ok || !("message" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error?.message || "The action could not be completed."
            : "The action could not be completed.",
        );
      }

      setAssistantMessages((messages) => [
        ...messages.map((message) =>
          message.proposal?.id === proposal.id
            ? { ...message, proposal: undefined }
            : message,
        ),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.message,
        },
      ]);

      if (payload.clientAction?.type === "task_created") {
        const createdTask = payload.clientAction.task;
        setTasks((items) => [
          ...items,
          {
            id: createdTask.id,
            title: createdTask.title,
            titleAm: createdTask.title,
            project: "General",
            due: createdTask.dueAt
              ? new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(createdTask.dueAt))
              : t.todayLabel,
            priority:
              createdTask.priority === "urgent" || createdTask.priority === "high"
                ? "high"
                : createdTask.priority,
            done: false,
            assignees: [workspace.userInitials],
          },
        ]);
      }

      if (payload.clientAction?.type === "meeting_created") {
        const createdMeeting = payload.clientAction.meeting;
        setMeetings((items) =>
          [
            ...items.filter((item) => item.id !== createdMeeting.id),
            {
              id: createdMeeting.id,
              title: createdMeeting.title,
              description: null,
              startsAt: createdMeeting.startsAt,
              endsAt: createdMeeting.endsAt,
              location: createdMeeting.location,
              meetingUrl: null,
              attendeeEmails: createdMeeting.attendeeEmails,
              organizerId: workspace.userId,
              status: "scheduled" as const,
              cancellationReason: null,
            },
          ].sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
        );
      }

      if (payload.clientAction?.type === "meeting_cancelled") {
        const cancelledMeetingId = payload.clientAction.meetingId;
        setMeetings((items) =>
          items.filter((meeting) => meeting.id !== cancelledMeetingId),
        );
      }

      if (payload.clientAction?.type === "email_sent") {
        const sentEmail = payload.clientAction;
        setEmails((items) =>
          items.map((email) =>
            email.id === sentEmail.draftId
              ? {
                  ...email,
                  status: "sent",
                  sentAt: sentEmail.sentAt,
                  lastError: null,
                  updatedAt: sentEmail.sentAt,
                }
              : email,
          ),
        );
      }
    } catch (error) {
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "The action could not be completed.",
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  }

  function submitAssistant(event: FormEvent) {
    event.preventDefault();
    const message = assistantText.trim();
    if (!message || assistantBusy) return;
    setAssistantText("");
    void sendAgentRequest(message, false);
  }

  return (
    <div className={`app-shell ${language === "am" ? "ethiopic" : ""}`}>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={20} strokeWidth={2.4} /></div>
          <div><strong>Muna</strong><span>office</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <button className="workspace-switcher">
          <span className="workspace-logo">{workspace.name[0]?.toUpperCase() || "W"}</span>
          <span><small>Workspace</small><strong>{workspace.name}</strong></span>
          <ChevronDown size={16} />
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={activeNav === id ? "active" : ""}
              onClick={() => { setActiveNav(id); setMobileMenu(false); }}
            >
              <Icon size={19} />
              <span>{t[label]}</span>
              {id === "tasks" && <em>{incomplete}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {canInvite && <button onClick={() => { setInviteModal(true); setInviteCode(""); setInviteError(""); }}><UserPlus size={19} /><span>Invite teammate</span></button>}
          <button onClick={() => router.push('/settings/email')}><Settings size={19} /><span>Settings</span></button>
          <div className="profile-card">
            <span className="profile-avatar">{workspace.userInitials}</span>
            <span><strong>{workspace.userName}</strong><small>{workspace.mode === "demo" ? "Demo workspace" : roleLabel}</small></span>
            {workspace.mode === "supabase" ? <form action={signOutAction}><button type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></form> : <MoreHorizontal size={17} />}
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="sidebar-backdrop" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} />
            <kbd><Command size={12} />K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="language-button" onClick={() => switchLanguage(language === "en" ? "am" : "en")}>
              <span>{language === "en" ? "አማ" : "EN"}</span>
              <small>{language === "en" ? "Amharic" : "English"}</small>
            </button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={20} /><i /></button>
            <button className="assistant-button" onClick={() => setAssistantOpen(true)}><Sparkles size={16} />{t.assistant}</button>
          </div>
        </header>

        <div className="content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span>{t.todayLabel}</span> · {formatEthiopianDate(language, initialNow)}</p>
              <h1>{activeNav === "home" ? `${t.greeting}, ${firstName}` : t[navItems.find((item) => item.id === activeNav)?.label ?? "home"]}</h1>
              <p>{t.subtitle}</p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                activeNav === "outbox"
                  ? openEmailComposer()
                  : activeNav === "documents"
                  ? openDocumentUpload()
                  : activeNav === "calendar"
                    ? openMeetingForm()
                    : setTaskModal(true)
              }
            >
              {activeNav === "outbox" ? <PenLine size={18} /> : activeNav === "documents" ? <Upload size={18} /> : activeNav === "calendar" ? <CalendarPlus size={18} /> : <Plus size={18} />}
              {activeNav === "outbox" ? (language === "en" ? "Compose email" : "ኢሜይል ጻፍ") : activeNav === "documents" ? (language === "en" ? "Upload document" : "ሰነድ ጫን") : activeNav === "calendar" ? t.schedule : t.addTask}
            </button>
          </section>

          {activeNav === "outbox" ? (
            <section className="panel email-center">
              <div className="document-center-header">
                <div>
                  <span className="section-kicker">{emails.length} {language === "en" ? "personal messages" : "የግል መልዕክቶች"}</span>
                  <h2>{language === "en" ? "Email outbox" : "የኢሜይል መላኪያ ሳጥን"}</h2>
                  <p>{language === "en" ? "Drafts are private to you. Saving never sends; every delivery needs a separate review and approval." : "ረቂቆችዎ ለእርስዎ ብቻ ይታያሉ። ማስቀመጥ አይልክም፤ እያንዳንዱ መላክ የተለየ ግምገማና ማረጋገጫ ይፈልጋል።"}</p>
                </div>
                <div className="document-center-actions">
                  {workspace.mode === "supabase" && workspace.role === "owner" && <button type="button" onClick={() => router.push('/settings/email')}><Settings size={17} />{language === "en" ? "Email settings" : "የኢሜይል ቅንብሮች"}</button>}
                  <button type="button" onClick={() => openEmailComposer()}><PenLine size={17} />{language === "en" ? "Compose" : "ጻፍ"}</button>
                </div>
              </div>
              {emailError && <div className="document-error" role="alert">{emailError}</div>}
              {emailNotice && <div className="email-notice" role="status"><ShieldCheck size={16} />{emailNotice}</div>}
              <div className="email-table" role="table" aria-label="Personal email outbox">
                <div className="email-table-head" role="row">
                  <span>{language === "en" ? "Message" : "መልዕክት"}</span>
                  <span>{language === "en" ? "Recipients" : "ተቀባዮች"}</span>
                  <span>{language === "en" ? "Updated" : "የታደሰው"}</span>
                  <span>{language === "en" ? "Status" : "ሁኔታ"}</span>
                  <span>{language === "en" ? "Actions" : "ተግባራት"}</span>
                </div>
                {visibleEmails.map((email) => {
                  const canChange = email.status === "draft" || email.status === "failed";
                  return (
                    <article className="email-row" role="row" key={email.id}>
                      <div className="email-subject-cell">
                        <span className="email-file-icon"><Mail size={18} /></span>
                        <div><strong>{email.subject}</strong><small>{email.bodyText.replace(/\s+/g, " ").slice(0, 90)}</small></div>
                      </div>
                      <span className="email-recipients">{email.toEmails.join(", ")}</span>
                      <span>{new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.timezone }).format(new Date(email.updatedAt))}</span>
                      <span className={"email-status " + email.status}>
                        {email.status === "draft" ? (language === "en" ? "Draft" : "ረቂቅ") : email.status === "sending" ? (language === "en" ? "Sending" : "በመላክ ላይ") : email.status === "sent" ? (language === "en" ? "Sent" : "ተልኳል") : (language === "en" ? "Needs attention" : "ማስተካከያ ይፈልጋል")}
                      </span>
                      <div className="email-actions">
                        {canChange && <button type="button" onClick={() => openEmailComposer(email)} aria-label={"Edit " + email.subject} title="Edit draft"><PenLine size={16} /></button>}
                        {canChange && <button type="button" className="email-send-button" disabled={emailMutationBusy} onClick={() => void prepareEmailSend(email)} aria-label={"Review and send " + email.subject} title="Review and send"><Send size={16} /></button>}
                        {canChange && <button type="button" className="document-delete-button" onClick={() => { setEmailError(""); setEmailNotice(""); setEmailDeleteTarget(email); }} aria-label={"Delete " + email.subject} title="Delete draft"><Trash2 size={16} /></button>}
                      </div>
                    </article>
                  );
                })}
                {visibleEmails.length === 0 && (
                  <div className="document-empty">
                    <Mail size={30} />
                    <h3>{query ? (language === "en" ? "No matching messages" : "ተዛማጅ መልዕክት የለም") : (language === "en" ? "No email drafts yet" : "እስካሁን የኢሜይል ረቂቅ የለም")}</h3>
                    <p>{language === "en" ? "Compose here or ask Muna to prepare a professional email." : "እዚህ ይጻፉ ወይም ሙና ሙያዊ ኢሜይል እንድታዘጋጅ ይጠይቁ።"}</p>
                    {!query && <button type="button" onClick={() => openEmailComposer()}><PenLine size={16} />{language === "en" ? "Compose first email" : "የመጀመሪያውን ኢሜይል ጻፍ"}</button>}
                  </div>
                )}
              </div>
              <div className="document-agent-tip"><Sparkles size={17} /><p>{language === "en" ? "Try asking Muna: “Draft an email to supplier@example.com about the delivery delay.”" : "ሙናን፦ “ስለ መላኪያ መዘግየት ለsupplier@example.com ኢሜይል ጻፍ” ብለው ይጠይቁ።"}</p><button type="button" onClick={() => { setAssistantOpen(true); setAssistantText("Draft an email to supplier@example.com about the delivery delay"); }}>{language === "en" ? "Ask Muna" : "ሙናን ጠይቅ"}</button></div>
            </section>
          ) : activeNav === "documents" ? (
            <section className="panel document-center">
              <div className="document-center-header">
                <div>
                  <span className="section-kicker">{documents.length} {language === "en" ? "company files" : "የድርጅት ፋይሎች"}</span>
                  <h2>{language === "en" ? "Company knowledge" : "የድርጅት ዕውቀት"}</h2>
                  <p>{language === "en" ? "Private files are searchable by Muna and visible only to members of this workspace." : "የግል ፋይሎችን ሙና መፈለግ ትችላለች፤ የሚታዩትም ለዚህ ድርጅት አባላት ብቻ ነው።"}</p>
                </div>
                <button type="button" onClick={openDocumentUpload}><Upload size={17} />{language === "en" ? "Upload" : "ጫን"}</button>
              </div>
              {documentError && <div className="document-error" role="alert">{documentError}</div>}
              <div className="document-table" role="table" aria-label="Company documents">
                <div className="document-table-head" role="row">
                  <span>{language === "en" ? "Document" : "ሰነድ"}</span>
                  <span>{language === "en" ? "Size" : "መጠን"}</span>
                  <span>{language === "en" ? "Uploaded" : "የተጫነበት"}</span>
                  <span>{language === "en" ? "Status" : "ሁኔታ"}</span>
                  <span>{language === "en" ? "Actions" : "ተግባራት"}</span>
                </div>
                {visibleDocuments.map((document) => {
                  const canDeleteDocument =
                    document.uploadedBy === workspace.userId ||
                    workspace.role === "owner" ||
                    workspace.role === "manager";
                  const extension = document.name.split(".").pop()?.toUpperCase() || "FILE";
                  return (
                    <article className="document-row" role="row" key={document.id}>
                      <div className="document-name-cell">
                        <span className="document-file-icon"><FileText size={19} /></span>
                        <div><strong>{document.name}</strong><small>{extension}</small></div>
                      </div>
                      <span>{formatFileSize(document.sizeBytes)}</span>
                      <span>{new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en-ET", { dateStyle: "medium", timeZone: workspace.timezone }).format(new Date(document.createdAt))}</span>
                      <span className={"document-status " + document.status} title={document.extractionError || undefined}>
                        {document.status === "ready" ? (language === "en" ? "Searchable" : "የሚፈለግ") : document.status === "processing" ? (language === "en" ? "Processing" : "በማዘጋጀት ላይ") : (language === "en" ? "Text unavailable" : "ጽሑፍ አልተገኘም")}
                      </span>
                      <div className="document-actions">
                        <button type="button" onClick={() => window.open("/api/documents/" + encodeURIComponent(document.id) + "/download", "_blank", "noopener,noreferrer")} aria-label={"Download " + document.name} title="Download"><Download size={17} /></button>
                        {canDeleteDocument && <button type="button" className="document-delete-button" onClick={() => { setDocumentError(""); setDocumentDeleteTarget(document); }} aria-label={"Delete " + document.name} title="Delete"><Trash2 size={17} /></button>}
                      </div>
                    </article>
                  );
                })}
                {visibleDocuments.length === 0 && (
                  <div className="document-empty">
                    <FolderOpen size={30} />
                    <h3>{query ? (language === "en" ? "No matching documents" : "ተዛማጅ ሰነድ የለም") : (language === "en" ? "No documents yet" : "እስካሁን ሰነድ የለም")}</h3>
                    <p>{language === "en" ? "Upload PDF, DOCX, TXT, Markdown, CSV, or JSON files up to 10 MB." : "እስከ 10 MB የሚደርስ PDF፣ DOCX፣ TXT፣ Markdown፣ CSV ወይም JSON ፋይል ይጫኑ።"}</p>
                    {!query && <button type="button" onClick={openDocumentUpload}><Upload size={16} />{language === "en" ? "Upload first document" : "የመጀመሪያውን ሰነድ ጫን"}</button>}
                  </div>
                )}
              </div>
              <div className="document-agent-tip"><Sparkles size={17} /><p>{language === "en" ? "Try asking Muna: “Summarize the Supplier Agreement 2026 document.”" : "ሙናን “የSupplier Agreement 2026 ሰነድን አጠቃልል” ብለው ይጠይቁ።"}</p><button type="button" onClick={() => { setAssistantOpen(true); setAssistantText("Summarize the Supplier Agreement 2026 document"); }}>{language === "en" ? "Ask Muna" : "ሙናን ጠይቅ"}</button></div>
            </section>
          ) : (
          <>
          <section className="stat-grid">
            <article><div className="stat-icon amber"><CheckCircle2 size={21} /></div><div><strong>{incomplete}</strong><span>{t.today} {t.tasks}</span></div><small>2 urgent</small></article>
            <article><div className="stat-icon blue"><CalendarDays size={21} /></div><div><strong>{todayMeetings.length}</strong><span>{t.today} {t.meetings}</span></div><small>{scheduledMeetings[0] ? `${language === "en" ? "Next" : "ቀጣይ"}: ${meetingClock(scheduledMeetings[0], language, workspace.timezone).time}` : (language === "en" ? "No meetings" : "ስብሰባ የለም")}</small></article>
            <article><div className="stat-icon violet"><Clock3 size={21} /></div><div><strong>4</strong><span>{t.pending}</span></div><small>Oldest: 2 days</small></article>
            <article><div className="stat-icon green"><Sparkles size={21} /></div><div><strong>{completed + 11}</strong><span>{t.completed}</span></div><small className="positive">↑ 18%</small></article>
          </section>

          <div className="dashboard-grid">
            <section className="panel task-panel">
              <div className="panel-header">
                <div><span className="section-kicker">{t.today}</span><h2>{t.focus}</h2></div>
                <button onClick={() => setActiveNav("tasks")}>{t.viewAll} <span>→</span></button>
              </div>
              <div className="task-list">
                {taskError && <div className="task-error" role="alert">{taskError}</div>}
                {visibleTasks.map((task) => (
                  <article className={`task-row ${task.done ? "task-done" : ""}`} key={task.id}>
                    <button className="task-check" disabled={taskMutationBusy} onClick={() => void toggleTask(task.id)} aria-label={`Mark ${task.title} complete`}>
                      {task.done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                    </button>
                    <div className="task-copy">
                      <strong>{language === "am" ? task.titleAm : task.title}</strong>
                      <span><i className={`priority-dot ${task.priority}`} />{task.project}<b>·</b><Clock3 size={13} />{task.due}</span>
                    </div>
                    <div className="avatar-stack">
                      {task.assignees.map((person, index) => <span key={person} className={`avatar avatar-${index}`}>{person}</span>)}
                    </div>
                    <button className="row-more" aria-label="Task options"><MoreHorizontal size={19} /></button>
                  </article>
                ))}
                {visibleTasks.length === 0 && <div className="empty-state"><Search size={24} /><p>{t.noMatches}</p></div>}
              </div>
            </section>

            <section className="panel meetings-panel">
              <div className="panel-header"><div><span className="section-kicker">{scheduledMeetings.length} {language === "en" ? "scheduled" : "የተያዙ"}</span><h2>{t.upcoming}</h2></div><button onClick={() => openMeetingForm()}>{t.schedule} <span>＋</span></button></div>
              <div className="meeting-list">
                {meetingError && <div className="task-error" role="alert">{meetingError}</div>}
                {scheduledMeetings.slice(0, 5).map((meeting, index) => {
                  const clock = meetingClock(meeting, language, workspace.timezone);
                  const people = meeting.attendeeEmails.length + 1;
                  const canManage = workspace.role === "owner" || workspace.role === "manager" || meeting.organizerId === workspace.userId;
                  return (
                    <article key={meeting.id}>
                      <div className="meeting-time"><strong>{clock.time}</strong><span>{clock.period}</span></div>
                      <i className={["orange", "blue", "green"][index % 3]} />
                      <div><strong>{meeting.title}</strong><span>{meeting.location || (language === "en" ? "No location" : "ቦታ አልተገለጸም")} · {people} {language === "en" ? (people === 1 ? "person" : "people") : "ሰዎች"}</span></div>
                      <button disabled={!canManage} onClick={() => canManage && openMeetingForm(meeting)} aria-label={`Edit ${meeting.title}`} title={canManage ? "Edit meeting" : "Only the organizer or a manager can edit"}><MoreHorizontal size={18} /></button>
                    </article>
                  );
                })}
                {scheduledMeetings.length === 0 && <div className="empty-state meeting-empty"><CalendarDays size={24} /><p>{language === "en" ? "No upcoming meetings." : "ቀጣይ ስብሰባ የለም።"}</p><button onClick={() => openMeetingForm()}>{t.schedule}</button></div>}
              </div>
            </section>

            <section className="panel assistant-card">
              <div className="assistant-glow" />
              <div className="assistant-heading"><span><Sparkles size={18} /></span><div><h2>{t.assistant}</h2><p>{t.assistantSubtitle}</p></div><i>AI</i></div>
              <p className="assistant-intro">{language === "en" ? "I can draft emails, summarize meetings, find documents, and organize your day." : "ኢሜይል መጻፍ፣ ስብሰባ ማጠቃለል፣ ሰነድ መፈለግ እና ቀንዎን ማደራጀት እችላለሁ።"}</p>
              <button className="assistant-prompt" onClick={() => setAssistantOpen(true)}><span>{t.askAnything}</span><Mic size={17} /></button>
              <div className="suggestion-chips">
                <button onClick={() => setAssistantOpen(true)}>Summarize my day</button>
                <button onClick={() => setAssistantOpen(true)}>Draft a follow-up</button>
              </div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-header"><div><span className="section-kicker">Team updates</span><h2>{t.activity}</h2></div><button>View all <span>→</span></button></div>
              <div className="activity-list">
                {activity.map((item) => (
                  <article key={item.strong}>
                    <span className={`activity-avatar ${item.color}`}>{item.initials}</span>
                    <div><p>{item.text} <strong>{item.strong}</strong></p><span>{item.time}</span></div>
                  </article>
                ))}
              </div>
            </section>
          </div>
          </>
          )}
        </div>
      </main>

      {taskModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setTaskModal(false)}>
          <form className="modal-card" onSubmit={submitTask} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-icon"><CheckCircle2 size={20} /></span><h2>{t.createTask}</h2></div><button type="button" className="icon-button" onClick={() => setTaskModal(false)}><X size={20} /></button></div>
            <label>{t.taskTitle}<input autoFocus disabled={taskMutationBusy} value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder={language === "en" ? "e.g. Call Addis supplier" : "ለምሳሌ፦ ለአዲስ አቅራቢ ይደውሉ"} /></label>
            {taskError && <div className="auth-notice error">{taskError}</div>}
            <div className="modal-actions"><button type="button" disabled={taskMutationBusy} onClick={() => setTaskModal(false)}>{t.cancel}</button><button className="primary-button" disabled={taskMutationBusy || !newTask.trim()} type="submit"><Plus size={17} />{taskMutationBusy ? "Saving…" : t.create}</button></div>
          </form>
        </div>
      )}

      {emailModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !emailMutationBusy && setEmailModal(false)}>
          <form className="modal-card email-compose-modal" onSubmit={submitEmailDraft} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-icon"><Mail size={20} /></span><h2>{editingEmail ? (language === "en" ? "Edit email draft" : "የኢሜይል ረቂቅ አስተካክል") : (language === "en" ? "Compose an email" : "ኢሜይል ጻፍ")}</h2></div><button type="button" className="icon-button" disabled={emailMutationBusy} onClick={() => setEmailModal(false)}><X size={20} /></button></div>
            <p className="email-compose-safety"><ShieldCheck size={15} />{language === "en" ? "This saves a private draft only. Sending always requires a second confirmation." : "ይህ የግል ረቂቅ ብቻ ያስቀምጣል። መላክ ሁልጊዜ ሁለተኛ ማረጋገጫ ይፈልጋል።"}</p>
            <label>{language === "en" ? "To" : "ወደ"}<input type="text" autoFocus required value={emailDraft.to} onChange={(event) => setEmailDraft((draft) => ({ ...draft, to: event.target.value }))} placeholder="supplier@example.com" /></label>
            <div className="email-copy-fields">
              <label>{language === "en" ? "CC (optional)" : "CC (አማራጭ)"}<input type="text" value={emailDraft.cc} onChange={(event) => setEmailDraft((draft) => ({ ...draft, cc: event.target.value }))} /></label>
              <label>{language === "en" ? "BCC (optional)" : "BCC (አማራጭ)"}<input type="text" value={emailDraft.bcc} onChange={(event) => setEmailDraft((draft) => ({ ...draft, bcc: event.target.value }))} /></label>
            </div>
            <label>{language === "en" ? "Subject" : "ርዕስ"}<input type="text" required maxLength={240} value={emailDraft.subject} onChange={(event) => setEmailDraft((draft) => ({ ...draft, subject: event.target.value }))} /></label>
            <label>{language === "en" ? "Message" : "መልዕክት"}<textarea required maxLength={20000} value={emailDraft.bodyText} onChange={(event) => setEmailDraft((draft) => ({ ...draft, bodyText: event.target.value }))} /></label>
            {emailError && <p className="auth-notice error" role="alert">{emailError}</p>}
            <div className="modal-actions"><button type="button" disabled={emailMutationBusy} onClick={() => setEmailModal(false)}>{t.cancel}</button><button className="primary-button" disabled={emailMutationBusy || !emailDraft.to.trim() || !emailDraft.subject.trim() || !emailDraft.bodyText.trim()} type="submit"><PenLine size={17} />{emailMutationBusy ? (language === "en" ? "Saving…" : "በማስቀመጥ ላይ…") : (language === "en" ? "Save draft" : "ረቂቅ አስቀምጥ")}</button></div>
          </form>
        </div>
      )}

      {emailDeleteTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !emailMutationBusy && setEmailDeleteTarget(null)}>
          <div className="modal-card document-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-email-title" onMouseDown={(event) => event.stopPropagation()}>
            <span><Trash2 size={23} /></span>
            <h2 id="delete-email-title">{language === "en" ? "Delete this draft?" : "ይህን ረቂቅ ይሰርዙ?"}</h2>
            <p>{emailDeleteTarget.subject}</p>
            <small>{language === "en" ? "The draft will be permanently removed. No email will be sent." : "ረቂቁ በቋሚነት ይወገዳል። ምንም ኢሜይል አይላክም።"}</small>
            <div className="modal-actions"><button type="button" disabled={emailMutationBusy} onClick={() => setEmailDeleteTarget(null)}>{language === "en" ? "Keep draft" : "ረቂቁን አቆይ"}</button><button type="button" className="danger-button" disabled={emailMutationBusy} onClick={() => void confirmEmailDeletion()}>{emailMutationBusy ? (language === "en" ? "Deleting…" : "በመሰረዝ ላይ…") : (language === "en" ? "Delete draft" : "ረቂቁን ሰርዝ")}</button></div>
          </div>
        </div>
      )}

      {emailSendProposal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !emailMutationBusy && setEmailSendProposal(null)}>
          <div className="modal-card email-send-confirm" role="alertdialog" aria-modal="true" aria-labelledby="send-email-title" onMouseDown={(event) => event.stopPropagation()}>
            <span><Send size={23} /></span>
            <h2 id="send-email-title">{language === "en" ? "Send this email?" : "ይህን ኢሜይል ይላኩ?"}</h2>
            <p className="email-confirm-warning"><ShieldCheck size={15} />{language === "en" ? "This is the final approval. It creates an external side effect." : "ይህ የመጨረሻ ማረጋገጫ ነው። ወደ ውጭ ኢሜይል ይልካል።"}</p>
            <dl>
              <div><dt>{language === "en" ? "To" : "ወደ"}</dt><dd>{emailSendProposal.input.toEmails.join(", ")}</dd></div>
              {emailSendProposal.input.ccEmails.length > 0 && <div><dt>CC</dt><dd>{emailSendProposal.input.ccEmails.join(", ")}</dd></div>}
              {emailSendProposal.input.bccEmails.length > 0 && <div><dt>BCC</dt><dd>{emailSendProposal.input.bccEmails.join(", ")}</dd></div>}
              <div><dt>{language === "en" ? "Subject" : "ርዕስ"}</dt><dd>{emailSendProposal.input.subject}</dd></div>
            </dl>
            <blockquote>{emailSendProposal.input.bodyPreview}</blockquote>
            {workspace.mode === "demo" && <p className="email-demo-note">{language === "en" ? "Demo mode: approval records a simulated delivery; no external email is contacted." : "የሙከራ ሁኔታ፦ ማረጋገጫው የተመሰለ መላኪያ ብቻ ይመዘግባል፤ ኢሜይል አይላክም።"}</p>}
            <div className="modal-actions"><button type="button" disabled={emailMutationBusy} onClick={() => setEmailSendProposal(null)}>{language === "en" ? "Do not send" : "አትላክ"}</button><button type="button" className="primary-button" disabled={emailMutationBusy} onClick={() => void approveEmailSend()}><Send size={16} />{emailMutationBusy ? (language === "en" ? "Sending…" : "በመላክ ላይ…") : (language === "en" ? "Approve & send" : "አረጋግጥ እና ላክ")}</button></div>
          </div>
        </div>
      )}

      {documentModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !documentMutationBusy && setDocumentModal(false)}>
          <form className="modal-card document-upload-modal" onSubmit={submitDocument} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-icon"><Upload size={20} /></span><h2>{language === "en" ? "Upload a company document" : "የድርጅት ሰነድ ጫን"}</h2></div><button type="button" className="icon-button" disabled={documentMutationBusy} onClick={() => setDocumentModal(false)}><X size={20} /></button></div>
            <label className="document-drop-zone">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json"
                disabled={documentMutationBusy}
                onChange={(event) => setSelectedDocument(event.target.files?.[0] || null)}
              />
              <span><Upload size={24} /></span>
              <strong>{selectedDocument ? selectedDocument.name : (language === "en" ? "Choose a document" : "ሰነድ ይምረጡ")}</strong>
              <small>{selectedDocument ? formatFileSize(selectedDocument.size) : (language === "en" ? "PDF, DOCX, TXT, Markdown, CSV, or JSON · maximum 10 MB" : "PDF፣ DOCX፣ TXT፣ Markdown፣ CSV ወይም JSON · ከፍተኛው 10 MB")}</small>
            </label>
            <p className="document-upload-note"><Sparkles size={15} />{language === "en" ? "Muna will extract searchable text. Scanned image-only documents need OCR in a later step." : "ሙና የሚፈለግ ጽሑፍ ታወጣለች። ምስል ብቻ ያላቸው ሰነዶች በቀጣይ OCR ያስፈልጋቸዋል።"}</p>
            {documentError && <div className="auth-notice error">{documentError}</div>}
            <div className="modal-actions"><button type="button" disabled={documentMutationBusy} onClick={() => setDocumentModal(false)}>{t.cancel}</button><button className="primary-button" disabled={documentMutationBusy || !selectedDocument} type="submit"><Upload size={17} />{documentMutationBusy ? (language === "en" ? "Uploading…" : "በመጫን ላይ…") : (language === "en" ? "Upload document" : "ሰነድ ጫን")}</button></div>
          </form>
        </div>
      )}

      {documentDeleteTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !documentMutationBusy && setDocumentDeleteTarget(null)}>
          <div className="modal-card document-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" onMouseDown={(event) => event.stopPropagation()}>
            <span><Trash2 size={23} /></span>
            <h2 id="delete-document-title">{language === "en" ? "Delete this document?" : "ይህን ሰነድ ይሰርዙ?"}</h2>
            <p>{documentDeleteTarget.name}</p>
            <small>{language === "en" ? "The file and its searchable text will be permanently removed from this company workspace." : "ፋይሉ እና የሚፈለገው ጽሑፉ ከዚህ ድርጅት እስከመጨረሻው ይወገዳሉ።"}</small>
            {documentError && <div className="auth-notice error">{documentError}</div>}
            <div className="modal-actions"><button type="button" disabled={documentMutationBusy} onClick={() => setDocumentDeleteTarget(null)}>{language === "en" ? "Keep document" : "ሰነዱን አቆይ"}</button><button type="button" className="danger-button" disabled={documentMutationBusy} onClick={() => void confirmDocumentDeletion()}>{documentMutationBusy ? (language === "en" ? "Deleting…" : "በመሰረዝ ላይ…") : (language === "en" ? "Confirm deletion" : "ስረዛውን አረጋግጥ")}</button></div>
          </div>
        </div>
      )}

      {meetingModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !meetingMutationBusy && setMeetingModal(false)}>
          <form className="modal-card meeting-modal" onSubmit={submitMeeting} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-icon"><CalendarPlus size={20} /></span><h2>{editingMeeting ? (language === "en" ? "Edit meeting" : "ስብሰባውን ያስተካክሉ") : (language === "en" ? "Schedule a meeting" : "ስብሰባ ያስይዙ")}</h2></div><button type="button" className="icon-button" disabled={meetingMutationBusy} onClick={() => setMeetingModal(false)}><X size={20} /></button></div>
            {meetingCancelConfirm && editingMeeting ? (
              <div className="meeting-cancel-confirm">
                <span><Trash2 size={22} /></span>
                <h3>{language === "en" ? "Cancel this meeting?" : "ይህን ስብሰባ ይሰርዙ?"}</h3>
                <p>{editingMeeting.title}</p>
                <label>{language === "en" ? "Reason (optional)" : "ምክንያት (አማራጭ)"}<textarea value={meetingCancellationReason} onChange={(event) => setMeetingCancellationReason(event.target.value)} maxLength={500} /></label>
                {meetingError && <div className="auth-notice error">{meetingError}</div>}
                <div className="modal-actions"><button type="button" disabled={meetingMutationBusy} onClick={() => setMeetingCancelConfirm(false)}>{language === "en" ? "Keep meeting" : "ስብሰባውን ያቆዩ"}</button><button type="button" className="danger-button" disabled={meetingMutationBusy} onClick={() => void confirmMeetingCancellation()}>{meetingMutationBusy ? "Cancelling…" : (language === "en" ? "Confirm cancellation" : "ስረዛውን ያረጋግጡ")}</button></div>
              </div>
            ) : <>
              <label>{language === "en" ? "Meeting title" : "የስብሰባ ርዕስ"}<input autoFocus disabled={meetingMutationBusy} value={meetingDraft.title} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Supplier contract review" required /></label>
              <div className="meeting-time-fields"><label>{language === "en" ? "Starts" : "መጀመሪያ"}<input type="datetime-local" disabled={meetingMutationBusy} value={meetingDraft.startsAt} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, startsAt: event.target.value }))} required /></label><label>{language === "en" ? "Ends" : "መጨረሻ"}<input type="datetime-local" disabled={meetingMutationBusy} value={meetingDraft.endsAt} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, endsAt: event.target.value }))} required /></label></div>
              <p className="timezone-note"><Clock3 size={13} /> {workspace.timezone} · {language === "en" ? "Ethiopian local time" : "የኢትዮጵያ ሰዓት"}</p>
              <label>{language === "en" ? "Location" : "ቦታ"}<input disabled={meetingMutationBusy} value={meetingDraft.location} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, location: event.target.value }))} placeholder="Meeting room or online" /></label>
              <label>{language === "en" ? "Meeting link (optional)" : "የስብሰባ ሊንክ (አማራጭ)"}<input type="url" disabled={meetingMutationBusy} value={meetingDraft.meetingUrl} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, meetingUrl: event.target.value }))} placeholder="https://meet.google.com/..." /></label>
              <label>{language === "en" ? "Attendee emails" : "የተሳታፊዎች ኢሜይል"}<textarea disabled={meetingMutationBusy} value={meetingDraft.attendeeEmails} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, attendeeEmails: event.target.value }))} placeholder="dawit@company.com, mekdes@company.com" /></label>
              <label>{language === "en" ? "Agenda (optional)" : "አጀንዳ (አማራጭ)"}<textarea disabled={meetingMutationBusy} value={meetingDraft.description} onChange={(event) => setMeetingDraft((draft) => ({ ...draft, description: event.target.value }))} maxLength={2000} /></label>
              {meetingError && <div className="auth-notice error">{meetingError}</div>}
              <div className="modal-actions meeting-modal-actions">{editingMeeting && <button type="button" className="cancel-meeting-button" disabled={meetingMutationBusy} onClick={() => setMeetingCancelConfirm(true)}><Trash2 size={15} />{language === "en" ? "Cancel meeting" : "ስብሰባውን ይሰርዙ"}</button>}<button type="button" disabled={meetingMutationBusy} onClick={() => setMeetingModal(false)}>{t.cancel}</button><button className="primary-button" disabled={meetingMutationBusy || !meetingDraft.title.trim()} type="submit">{meetingMutationBusy ? "Saving…" : (editingMeeting ? (language === "en" ? "Save changes" : "ለውጦችን ያስቀምጡ") : t.schedule)}</button></div>
            </>}
          </form>
        </div>
      )}

      {inviteModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setInviteModal(false)}>
          <form className="modal-card invite-modal" onSubmit={submitInvitation} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-icon"><UserPlus size={20} /></span><h2>Invite a teammate</h2></div><button type="button" className="icon-button" onClick={() => setInviteModal(false)}><X size={20} /></button></div>
            {!inviteCode ? <>
              <label>Teammate email<input autoFocus type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" required /></label>
              <label>Company role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "manager" | "employee")}><option value="employee">Employee</option>{workspace.role === "owner" && <option value="manager">Manager</option>}</select></label>
              <p className="modal-help">The code expires in 7 days and only works for this email address.</p>
              {inviteError && <div className="auth-notice error">{inviteError}</div>}
              <div className="modal-actions"><button type="button" onClick={() => setInviteModal(false)}>Cancel</button><button className="primary-button" type="submit" disabled={inviteBusy || !inviteEmail.trim()}>{inviteBusy ? "Creating…" : "Create invitation"}</button></div>
            </> : <div className="invite-result">
              <span><CheckCircle2 size={22} /></span>
              <h3>Invitation ready</h3>
              <p>Send this single-use code to <strong>{inviteEmail}</strong>.</p>
              <code>{inviteCode}</code>
              <button type="button" onClick={() => void navigator.clipboard.writeText(inviteCode)}><Copy size={16} /> Copy code</button>
            </div>}
          </form>
        </div>
      )}

      <aside className={`assistant-drawer ${assistantOpen ? "assistant-drawer-open" : ""}`}>
        <div className="drawer-header"><div className="assistant-heading"><span><Sparkles size={18} /></span><div><h2>{t.assistant}</h2><p><i /> {assistantBusy ? (language === "en" ? "Working" : "በሥራ ላይ") : munaVoiceActive ? (language === "en" ? "Live voice" : "የቀጥታ ድምፅ") : (language === "en" ? "Agent ready" : "ወኪሉ ዝግጁ ነው")}</p></div></div><button className="icon-button" onClick={closeAssistant}><X size={20} /></button></div>
        <div className="drawer-voice-profile">
          <div>
            <span><Volume2 size={16} /></span>
            <p>
              <strong>{language === "am" ? "የሙና የሴት ድምፅ" : "Muna's feminine voice"}</strong>
              <small>{realtimeStatus === "connected" ? (realtimeVoiceName || "marin") + " · Realtime" : voiceProfileName || (language === "am" ? "አማርኛ · ኢትዮጵያ" : "English · Ethiopia")}</small>
            </p>
          </div>
          <button type="button" disabled={assistantBusy || munaVoiceActive} onClick={() => switchLanguage(language === "en" ? "am" : "en")}>
            {language === "en" ? "አማርኛ" : "English"}
          </button>
        </div>
        <div className="drawer-content">
          <div className="muna-message"><span><Sparkles size={16} /></span><p>{language === "en" ? `Hello ${firstName}! I’m ready to help with your workday. What would you like to do?` : `ሰላም ${firstName}! በሥራ ቀንዎ ላይ ለመርዳት ዝግጁ ነኝ። ምን ማድረግ ይፈልጋሉ?`}</p></div>
          {assistantMessages.map((message) => message.role === "user" ? (
            <div className="user-message" key={message.id}>{message.text}</div>
          ) : (
            <div className="muna-message" key={message.id}>
              <span><Sparkles size={16} /></span>
              <div className="agent-response">
                <p>{message.text}</p>
                <button
                  type="button"
                  className="message-voice-button"
                  onClick={() => speakAssistantMessage(message.text, message.id)}
                  aria-label={voiceSpeakingId === message.id ? "Stop spoken reply" : "Read reply aloud"}
                  title={voiceSpeakingId === message.id ? "Stop spoken reply" : "Read reply aloud"}
                >
                  {voiceSpeakingId === message.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  {voiceSpeakingId === message.id
                    ? (language === "en" ? "Stop" : "አቁም")
                    : (language === "en" ? "Listen" : "አዳምጥ")}
                </button>
                {message.proposal && (
                  <div className="agent-proposal">
                    <strong>{agentProposalTitle(message.proposal)}</strong>
                    <small>{agentProposalMeta(message.proposal, language, workspace.timezone)}</small>
                    <button type="button" disabled={assistantBusy} onClick={() => void approveAgentAction(message.proposal!)}>
                      <CheckCircle2 size={16} />
                      {agentProposalButton(message.proposal, language)}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {assistantBusy && <div className="muna-message agent-thinking"><span><Sparkles size={16} /></span><p>{language === "en" ? "Muna is thinking…" : "ሙና እያሰበች ነው…"}</p></div>}
        </div>
        {(munaVoiceActive || realtimeStatus === "fallback" || voiceError) && (
          <div className={voiceError ? "drawer-voice-status drawer-voice-error" : realtimeStatus === "connected" ? "drawer-voice-status drawer-voice-live" : "drawer-voice-status"} role="status">
            <Mic size={15} />
            <span>{voiceError || realtimeActivity || (language === "en" ? "Muna is listening… Speak now." : "ሙና እየሰማች ነው… አሁን ይናገሩ።")}</span>
          </div>
        )}
        <div className="drawer-suggestions">
          <button onClick={() => setAssistantText("Summarize my meetings today")}>Summarize my meetings</button>
          <button onClick={() => setAssistantText("What tasks are overdue?")}>Find overdue tasks</button>
          <button onClick={() => setAssistantText("Draft a supplier follow-up email")}>Draft an email</button>
        </div>
        <form className="drawer-composer" onSubmit={submitAssistant}><button type="button" disabled={assistantBusy}><Plus size={19} /></button><input disabled={assistantBusy} value={assistantText} onChange={(e) => setAssistantText(e.target.value)} placeholder={munaVoiceActive ? (language === "en" ? "Live voice is active…" : "የቀጥታ ድምፅ ክፍት ነው…") : t.askAnything} /><button type="button" className={munaVoiceActive ? "voice-button listening" : "voice-button"} disabled={assistantBusy && !munaVoiceActive} onClick={toggleMunaVoice} aria-pressed={munaVoiceActive} aria-label={munaVoiceActive ? "Stop Muna live voice" : "Start Muna live voice"} title={munaVoiceActive ? "Stop live voice" : "Talk to Muna live"}><Mic size={18} /></button><button type="submit" className="send-button" disabled={assistantBusy || !assistantText.trim()}><Send size={17} /></button></form>
      </aside>
      {assistantOpen && <button className="drawer-backdrop" onClick={closeAssistant} aria-label="Close assistant" />}
    </div>
  );
}
