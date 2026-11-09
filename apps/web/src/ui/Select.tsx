import { t } from '../i18n/index.js';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { toneOf } from './tone.js';
import './select.css';

type Option = { value: string; label: string; disabled: boolean; group?: string };
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textOf(child.props.children)
        : String(child),
    )
    .join('');
}
function optionsOf(children: ReactNode, group?: string, disabled = false): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        label?: string;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? textOf(child.props.children)),
          label: child.props.label ?? textOf(child.props.children),
          disabled: disabled || !!child.props.disabled,
          group,
        },
      ];
    return optionsOf(
      child.props.children,
      child.type === 'optgroup' ? child.props.label : group,
      disabled || !!child.props.disabled,
    );
  });
}

/** A themed listbox. The backing select preserves FormData and existing change handlers. */
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  className = '',
  style,
  id,
  disabled,
  busy = false,
  multiple,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { busy?: boolean }) {
  const uid = useId(),
    native = useRef<HTMLSelectElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    root = useRef<HTMLSpanElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const options = optionsOf(children);
  const optionsKey = JSON.stringify(options);
  const topLayer = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  const [local, setLocal] = useState(
    value ??
      defaultValue ??
      (multiple ? [] : (options.find((option) => !option.disabled)?.value ?? '')),
  );
  const current = value ?? local;
  const selected = (Array.isArray(current) ? current : [current]).map(String);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const search = useRef({ text: '', time: 0 });
  const [implicitLabel, setImplicitLabel] = useState<string>();
  const [validation, setValidation] = useState('');
  const ariaLabel = props['aria-label'],
    ariaLabelledBy = props['aria-labelledby'];
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useLayoutEffect(() => {
    if (ariaLabel || ariaLabelledBy) return;
    // A listbox stays inside the label so it also stays in a modal's top layer.
    // Its option text must never become part of the trigger's accessible name.
    const label = Array.from(trigger.current?.labels ?? [])
      .map((element) => {
        const copy = element.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('.select-control').forEach((control) => control.remove());
        return copy.textContent?.trim() ?? '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    setImplicitLabel(label || undefined);
  }, [children, id, ariaLabel, ariaLabelledBy]);
  const first = () =>
    Math.max(
      0,
      options.findIndex((option) => !option.disabled && selected.includes(option.value)) >= 0
        ? options.findIndex((option) => !option.disabled && selected.includes(option.value))
        : options.findIndex((option) => !option.disabled),
    );
  const show = () => {
    if (!disabled && !busy) {
      setActive(first());
      setOpen(true);
    }
  };
  const choose = (index: number) => {
    const option = options[index],
      element = native.current;
    if (!option || option.disabled || !element || busy) return;
    const next = multiple
      ? selected.includes(option.value)
        ? selected.filter((item) => item !== option.value)
        : [...selected, option.value]
      : option.value;
    setLocal(next);
    if (multiple)
      Array.from(element.options).forEach((item) => {
        item.selected = (next as string[]).includes(item.value);
      });
    else element.value = next as string;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (!multiple) setOpen(false);
    trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    menu.current?.showPopover?.();
    const place = () => {
      const box = trigger.current!.getBoundingClientRect();
      const width = Math.min(Math.max(box.width, 180), innerWidth - 16);
      const below = innerHeight - box.bottom - 12,
        above = box.top - 12;
      const maxHeight = Math.min(280, Math.max(64, below >= Math.min(200, above) ? below : above));
      const height = Math.min(menu.current?.scrollHeight ?? 280, maxHeight);
      setPosition({
        left: Math.max(8, Math.min(box.left, innerWidth - width - 8)),
        top: below >= Math.min(200, above) ? box.bottom + 5 : Math.max(8, box.top - height - 5),
        width,
        maxHeight,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, optionsKey]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, uid]);
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const renderMenu = (content: ReactNode) =>
    topLayer ? content : createPortal(content, root.current?.closest('dialog') ?? document.body);
  return (
    <span className={`select-control${multiple ? ' select-multiple' : ''}`} ref={root}>
      <button
        type="button"
        ref={trigger}
        id={id ?? `${uid}-trigger`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        aria-label={props['aria-label'] ?? implicitLabel}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={
          [props['aria-describedby'], validation ? `${uid}-error` : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-invalid={props['aria-invalid'] ?? (validation ? true : undefined)}
        aria-required={props.required}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        title={props.title}
        disabled={disabled}
        autoFocus={props.autoFocus}
        tabIndex={props.tabIndex}
        className={`select-trigger ${className}`}
        style={style}
        {...Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('data-')))}
        onFocus={(event) => onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>)}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>);
        }}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
          }
          if (event.key === 'Tab') {
            setOpen(false);
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const enabled = options
              .map((option, index) => (option.disabled ? -1 : index))
              .filter((index) => index >= 0);
            const index = enabled.indexOf(active);
            setActive(
              event.key === 'Home'
                ? (enabled[0] ?? 0)
                : event.key === 'End'
                  ? (enabled.at(-1) ?? 0)
                  : !open
                    ? first()
                    : (enabled[
                        (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                          enabled.length
                      ] ?? 0),
            );
            setOpen(true);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) choose(active);
            else show();
            return;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            search.current.text =
              now - search.current.time > 700 ? event.key : search.current.text + event.key;
            search.current.time = now;
            const query = search.current.text.toLocaleLowerCase();
            const match = options.findIndex(
              (option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(query),
            );
            if (match >= 0) {
              setActive(match);
              setOpen(true);
            }
            return;
          }
          onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLSelectElement>);
        }}
      >
        <span className="select-value">
          {multiple ? (
            selectedOptions.length ? (
              selectedOptions.map((option) => (
                <span key={option.value} className="select-chip" data-tone={toneOf(option.value)}>
                  {option.label}
                </span>
              ))
            ) : (
              <span className="select-placeholder">{t('Empty')}</span>
            )
          ) : (
            (selectedOptions[0]?.label ?? t('Select…'))
          )}
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      <select
        {...props}
        ref={native}
        value={current}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          if (event.currentTarget.validity.valid) setValidation('');
          onChange?.(event);
        }}
        aria-hidden="true"
        aria-label={undefined}
        aria-labelledby={undefined}
        tabIndex={-1}
        className="select-native"
        onInvalid={(event) => {
          event.preventDefault();
          setValidation(
            event.currentTarget.validity.valueMissing
              ? 'Please select an option.'
              : event.currentTarget.validationMessage,
          );
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
      >
        {children}
      </select>
      {validation && (
        <span id={`${uid}-error`} className="select-error" role="alert">
          {t(validation)}
        </span>
      )}
      {open &&
        !disabled &&
        renderMenu(
          <div
            ref={menu}
            id={`${uid}-list`}
            role="listbox"
            popover={topLayer ? 'manual' : undefined}
            aria-labelledby={id ?? `${uid}-trigger`}
            aria-multiselectable={multiple || undefined}
            aria-busy={busy || undefined}
            className="select-menu"
            style={position}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              // Wrapped labels otherwise forward an option click to the trigger.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {options.map((option, index) => (
              <div key={`${option.value}-${index}`}>
                {option.group && option.group !== options[index - 1]?.group && (
                  <div className="select-group">{option.group}</div>
                )}
                <div
                  id={`${uid}-${index}`}
                  role="option"
                  aria-selected={selected.includes(option.value)}
                  aria-disabled={option.disabled || busy || undefined}
                  className={`select-option${active === index ? ' is-active' : ''}`}
                  onPointerMove={() => {
                    if (!option.disabled) setActive(index);
                  }}
                  onClick={() => choose(index)}
                >
                  <span className={`select-check${multiple ? ' is-checkbox' : ''}`}>
                    {selected.includes(option.value) && <Check size={12} />}
                  </span>
                  <span>{option.label}</span>
                </div>
              </div>
            ))}
            {!options.length && <div className="select-group">{t('No options')}</div>}
          </div>,
        )}
    </span>
  );
}
