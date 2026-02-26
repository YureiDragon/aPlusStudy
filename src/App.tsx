import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar.tsx';
import Header from './components/layout/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import ObjectiveBrowser from './components/ObjectiveBrowser.tsx';
import Flashcards from './components/Flashcards.tsx';
import QuizEngine from './components/QuizEngine.tsx';
import PracticeExam from './components/PracticeExam.tsx';
import Glossary from './components/Glossary.tsx';
import StudyNotes from './components/StudyNotes.tsx';
import Onboarding from './components/Onboarding.tsx';

export default function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/objectives" element={<ObjectiveBrowser />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/quiz" element={<QuizEngine />} />
            <Route path="/exam" element={<PracticeExam />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/notes" element={<StudyNotes />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
