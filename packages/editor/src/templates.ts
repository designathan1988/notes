import type { JSONContent } from '@tiptap/core';

export interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
  content: JSONContent[];
}
const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const heading = (text: string): JSONContent => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
const tasks = (...items: string[]): JSONContent => ({
  type: 'taskList',
  content: items.map((text) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [paragraph(text)],
  })),
});
export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'meeting',
    title: 'Meeting notes',
    description: 'Agenda, decisions and clear next steps.',
    content: [
      heading('Context'),
      paragraph('Date · Participants · Purpose'),
      heading('Agenda'),
      tasks('Add a topic to discuss', 'Capture the questions to answer'),
      heading('Discussion'),
      paragraph('Capture the important points and the reasons behind them.'),
      heading('Decisions'),
      paragraph('What did we agree on?'),
      heading('Next steps'),
      tasks('Assign an owner and a due date'),
    ],
  },
  {
    id: 'project',
    title: 'Project brief',
    description: 'A shared direction from intent to delivery.',
    content: [
      heading('Purpose'),
      paragraph('Describe the problem and who needs it solved.'),
      heading('Success criteria'),
      tasks('Define a measurable outcome'),
      heading('Scope'),
      paragraph('Describe the deliverables and the boundaries of this project.'),
      heading('Milestones'),
      tasks('Discovery', 'Build', 'Validate and deliver'),
      heading('Open questions'),
      paragraph('Capture the decisions that still need evidence.'),
    ],
  },
  {
    id: 'decision',
    title: 'Decision record',
    description: 'Keep the context, alternatives and consequences.',
    content: [
      heading('Context'),
      paragraph('Explain the situation and the constraints that matter.'),
      heading('Options considered'),
      paragraph('Describe the alternatives and their tradeoffs.'),
      heading('Decision'),
      paragraph('State the choice and why it fits the available evidence.'),
      heading('Consequences'),
      paragraph('What improves, what becomes harder, and what should we revisit?'),
      heading('Follow-up'),
      tasks('Record an owner and a review date'),
    ],
  },
  {
    id: 'research',
    title: 'Research notes',
    description: 'Connect questions, evidence and findings.',
    content: [
      heading('Research question'),
      paragraph('What do we need to learn, and why?'),
      heading('Method'),
      paragraph('Describe the sources, participants or experiments.'),
      heading('Evidence'),
      paragraph('Capture observations and link to their original sources.'),
      heading('Findings'),
      paragraph('Separate supported findings from assumptions.'),
      heading('Next questions'),
      tasks('Identify the next useful investigation'),
    ],
  },
];
