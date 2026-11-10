import {
  Calendar,
  CircleDot,
  Hash,
  Link2,
  ListChecks,
  MousePointerClick,
  Sigma,
  SquareCheck,
  Tags,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { RecordField } from '@note/contracts';

/** Each property says its kind of value with an icon, as the Dados and Registro boards do. */
export const fieldIcons: Record<RecordField['type'], LucideIcon> = {
  text: Type,
  number: Hash,
  checkbox: SquareCheck,
  select: CircleDot,
  'multi-select': Tags,
  date: Calendar,
  url: Link2,
  relation: ListChecks,
  formula: Sigma,
  button: MousePointerClick,
};
