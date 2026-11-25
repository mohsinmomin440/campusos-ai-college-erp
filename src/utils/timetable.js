/**
 * Deterministic timetable clash detector.
 * Flags overlapping slots on the same day sharing a room, faculty member, or class section.
 */
export function detectTimetableClash(existingSlots, candidate) {
  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return h * 60 + m;
  };
  const cStart = toMinutes(candidate.startTime);
  const cEnd = toMinutes(candidate.endTime);
  if (cEnd <= cStart) {
    return 'End time must be after start time.';
  }

  for (const slot of existingSlots) {
    if (slot.dayOfWeek !== candidate.dayOfWeek) continue;
    const sStart = toMinutes(slot.startTime);
    const sEnd = toMinutes(slot.endTime);
    const overlaps = cStart < sEnd && sStart < cEnd;
    if (!overlaps) continue;

    if (slot.room && candidate.room && slot.room.toLowerCase() === candidate.room.toLowerCase()) {
      return `Room clash with ${slot.subjectName} in ${slot.room} (${slot.startTime}–${slot.endTime}).`;
    }
    if (slot.facultyName && candidate.facultyName && slot.facultyName.toLowerCase() === candidate.facultyName.toLowerCase()) {
      return `Faculty clash: ${slot.facultyName} is already teaching ${slot.subjectName} (${slot.startTime}–${slot.endTime}).`;
    }
    if (slot.classId && candidate.classId && slot.classId === candidate.classId) {
      return `Class clash: ${slot.classId} already has ${slot.subjectName} (${slot.startTime}–${slot.endTime}).`;
    }
  }
  return null;
}
