import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  title?: string;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
  return (
    <button className={`${styles.iconButton} ${className ?? ''}`} {...props}>
      {children}
    </button>
  );
}
