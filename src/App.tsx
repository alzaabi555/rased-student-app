import React from 'react';
import { AppProvider } from './context/AppContext';
import StudentApp from './components/StudentApp';

function App() {
  return (
    <AppProvider>
      <StudentApp />
    </AppProvider>
  );
}

export default App;