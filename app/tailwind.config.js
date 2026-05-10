/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          0: '#fbf9f4',
          50: '#f7f3eb',
          100: '#ede4d0',
        },
        ink: {
          900: '#29261b',
          800: '#4a4238',
          600: '#6b6452',
          400: '#a8a092',
          300: '#ccc4b6',
        },
        rust: {
          50: '#f8e6d8',
          400: '#c96442',
        },
        moss: {
          600: '#4d6f48',
        },
        slate: {
          600: '#5a6f7d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Source Serif 4', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: '11.5px',
        sm: '12px',
        base: '13px',
        md: '13.5px',
        lg: '15px',
        xl: '17px',
      },
    },
  },
  plugins: [],
};
