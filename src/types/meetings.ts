export type MeetingStatus = 'scheduled' | 'cancelled';

export type MeetingRecordDTO = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingUrl: string | null;
  attendeeEmails: string[];
  organizerId: string;
  status: MeetingStatus;
  cancellationReason: string | null;
};

export type MeetingWriteInput = {
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingUrl: string | null;
  attendeeEmails: string[];
};
