/** Template email akademik (teks polos, tanpa rahasia). */

export function gradePublishedTemplate(input: {
  name: string;
  assignment: string;
  score: number;
  maxScore: number;
}): { subject: string; text: string } {
  return {
    subject: `Nilai keluar: ${input.assignment}`,
    text: [
      `Halo ${input.name},`,
      ``,
      `Nilai tugas "${input.assignment}" sudah keluar: ${input.score}/${input.maxScore}.`,
      `Lihat umpan balik di Study Club LMS.`,
    ].join("\n"),
  };
}

export function revisionRequestedTemplate(input: {
  name: string;
  assignment: string;
}): { subject: string; text: string } {
  return {
    subject: `Revisi diminta: ${input.assignment}`,
    text: [
      `Halo ${input.name},`,
      ``,
      `Mentor meminta revisi untuk tugas "${input.assignment}".`,
      `Periksa umpan balik lalu submit ulang di Study Club LMS.`,
    ].join("\n"),
  };
}

export function assignmentPublishedTemplate(input: {
  name: string;
  assignment: string;
  due: string;
}): { subject: string; text: string } {
  return {
    subject: `Tugas baru: ${input.assignment}`,
    text: [
      `Halo ${input.name},`,
      ``,
      `Tugas baru "${input.assignment}" dibuka, deadline ${input.due}.`,
      `Kerjakan di Study Club LMS.`,
    ].join("\n"),
  };
}
