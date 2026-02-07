/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // CSS 변수 기반 시맨틱 색상
      colors: {
        background: 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        foreground: 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        border: 'var(--color-border)',
        'border-light': 'var(--color-border-light)',
        card: 'var(--color-bg-secondary)',
        'card-hover': 'var(--color-bg-tertiary)',
        muted: 'var(--color-text-tertiary)',
        'muted-foreground': 'var(--color-text-secondary)',

        // 브랜드 컬러
        primary: {
          DEFAULT: 'var(--color-primary)',
          50: '#FFF5F5',
          100: '#FFE5E5',
          200: '#FFCCCC',
          300: '#FFB3B3',
          400: '#FF7A70',
          500: '#FF3B30',
          600: '#E62E24',
          700: '#CC2419',
          800: '#B31A0F',
          900: '#991105',
        },
        secondary: {
          DEFAULT: '#3742FA',
          50: '#F0F1FF',
          100: '#E0E3FF',
          200: '#C1C7FF',
          300: '#A2ABFF',
          400: '#697AFF',
          500: '#3742FA',
          600: '#2533E6',
          700: '#1A24CC',
          800: '#1018B3',
          900: '#080D99',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        success: {
          DEFAULT: '#34C759',
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#34C759',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        warning: {
          DEFAULT: '#FF9500',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF9500',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        danger: {
          DEFAULT: '#FF3B30',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#FF3B30',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        neutral: {
          50: '#F8F9FA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#191919',
        },
      },

      // 타이포그래피
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },

      // 둥근 모서리
      borderRadius: {
        none: '0',
        sm: '6px',
        DEFAULT: '8px',
        md: '12px',
        lg: '20px',
        xl: '24px',
        '2xl': '32px',
        full: '9999px',
      },

      // 그림자
      boxShadow: {
        sm: '0 2px 6px rgba(0, 0, 0, 0.06)',
        DEFAULT: '0 4px 12px rgba(0, 0, 0, 0.08)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
        xl: '0 12px 32px rgba(0, 0, 0, 0.16)',
        '2xl': '0 16px 48px rgba(0, 0, 0, 0.20)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
      },

      // 키프레임 애니메이션
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'nudge-bounce': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(2px)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.2)' },
          '50%': { transform: 'scale(1)' },
          '75%': { transform: 'scale(1.1)' },
        },
      },

      // 애니메이션 클래스
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        'spin-slow': 'spin-slow 2s linear infinite',
        'nudge-bounce': 'nudge-bounce 1s ease-in-out infinite',
        heartbeat: 'heartbeat 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    // 커스텀 유틸리티
    function ({ addUtilities }) {
      addUtilities({
        '.touch-feedback': {
          '-webkit-tap-highlight-color': 'transparent',
          'user-select': 'none',
          '-webkit-user-select': 'none',
        },
        '.glass': {
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'background-color': 'rgba(255, 255, 255, 0.1)',
        },
        '.glass-light': {
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'background-color': 'rgba(255, 255, 255, 0.8)',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
    },
  ],
};
