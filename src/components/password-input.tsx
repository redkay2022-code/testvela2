import { useId, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; label?: string };

/**
 * Password field with a "show password" checkbox underneath.
 * Used by sign-up / sign-in and by the admin re-confirmation dialogs so people can check what they typed.
 */
export function PasswordInput({ id, className = 'form-input', label = 'Show password', ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();
  return <>
    <input {...rest} id={id} className={className} type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false}/>
    <label htmlFor={toggleId} className="mt-2 flex w-fit cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
      <input id={toggleId} type="checkbox" className="size-4 accent-primary" checked={visible} onChange={e => setVisible(e.target.checked)}/>
      <span>{label}</span>
    </label>
  </>;
}
