/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: '#222',
        card: '#0f0f0f',
        'card-hover': '#1a1a1a',
        muted: '#666',
        'muted-foreground': '#aaa',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '8px',
      },
    },
  },
  plugins: [],
};
