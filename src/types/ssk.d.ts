import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ssk-theme-provider': React.HTMLAttributes<HTMLElement> & { brand?: string };
      'ssk-toast-provider': React.HTMLAttributes<HTMLElement>;
      'ssk-button': React.HTMLAttributes<HTMLElement> & {
        variant?: 'solid' | 'outline' | 'ghost' | 'link';
        themeColor?: string;
        size?: string;
        disabled?: boolean;
      };
      'ssk-tag': React.HTMLAttributes<HTMLElement> & {
        variant?: 'solid' | 'outline' | 'soft';
        themeColor?: string;
        size?: string;
      };
      'ssk-badge': React.HTMLAttributes<HTMLElement> & {
        variant?: string;
        themeColor?: string;
        size?: string;
        hidden?: boolean;
      };
      'ssk-icon': React.HTMLAttributes<HTMLElement> & { name?: string; size?: string };
      'ssk-spinner': React.HTMLAttributes<HTMLElement> & { size?: string; themeColor?: string };
      'ssk-skeleton': React.HTMLAttributes<HTMLElement> & { width?: string; height?: string };
    }
  }
}
