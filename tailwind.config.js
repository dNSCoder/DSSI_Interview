/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './teacher.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        dssi: {
          indigo: '#3D3992',
          blue: '#30449C',
          periwinkle: '#5C6BB2',
          sky: '#92D8EF',
          'sky-soft': '#E8F6FC',
          'sky-line': '#BFE6F5',
          purple: '#8465AC',
          ink: '#12122B',
          muted: '#4B5170',
          go: '#1E9E5A',
          danger: '#B42318',
          'danger-soft': '#FEF3F2',
        },
      },
      fontFamily: {
        heading: ['Prompt', 'Noto Sans Thai', 'sans-serif'],
        body: ['Noto Sans Thai', 'Prompt', 'sans-serif'],
      },
      maxWidth: { page: '1240px' },
    },
  },
  plugins: [],
};
