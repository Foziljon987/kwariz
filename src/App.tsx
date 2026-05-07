import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, GradeConfig, Teacher, ScheduleResult } from './types';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType, signInWithEmail, signUpWithEmail } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, deleteDoc, updateDoc, query, where, getDocFromServer } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { User, School, Users, Calendar, AlertCircle, CheckCircle2, Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Download, Languages, Sun, Moon, Zap, BookOpen, Clock, MapPin, LayoutGrid, List, Settings2 } from 'lucide-react';
import { generateSchedule, suggestSubjects, suggestTeachers } from './lib/gemini';
import { exportScheduleToExcel } from './lib/excel';
import { getCanonicalDay, normalizeTime, isLessonMatch, validateSchedule } from './lib/formatters';
import { COUNTRIES, COUNTRIES_REGIONS } from './constants';
import { translations, Language } from './translations';

const getSubjectColor = (subject: string) => {
  const s = (subject || "").toLowerCase();
  
  // Specific color logic for common subjects
  if (s.includes('math') || s.includes('matem') || s.includes('algebra') || s.includes('geomet')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
  if (s.includes('science') || s.includes('fizika') || s.includes('kimyo') || s.includes('biolog') || s.includes('tabiiy') || s.includes('prirod')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (s.includes('english') || s.includes('ona tili') || s.includes('adabiyot') || s.includes('rus tili') || s.includes('til') || s.includes('yazik')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
  if (s.includes('history') || s.includes('tarix') || s.includes('geograph') || s.includes('geograf') || s.includes('huquq') || s.includes('istoriya')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
  if (s.includes('art') || s.includes('music') || s.includes('tasviriy') || s.includes('musiqa') || s.includes('izo')) return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400';
  if (s.includes('sport') || s.includes('phys') || s.includes('jismoniy') || s.includes('tarbiya') || s.includes('fizra')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400';
  if (s.includes('computer') || s.includes('tech') || s.includes('info') || s.includes('it')) return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400';
  
  // Hash-based fallback for other subjects
  const hash = subject.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colors = [
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300',
    'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-neutral-800 dark:text-neutral-300',
    'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
  ];
  return colors[Math.abs(hash) % colors.length];
};

const localizeSubject = (subject: string, t: any) => {
  const s = (subject || "").toLowerCase();
  const subT = t.subjects;
  if (!subT) return subject;

  if (s.includes('math') || s.includes('matem') || s.includes('algebra') || s.includes('geomet')) return subT.math;
  if (s.includes('physics') || s.includes('fizika')) return subT.physics;
  if (s.includes('chemistry') || s.includes('kimyo')) return subT.chemistry;
  if (s.includes('biology') || s.includes('biolog')) return subT.biology;
  if (s.includes('history') || s.includes('tarix') || s.includes('istoriya')) return subT.history;
  if (s.includes('geograph') || s.includes('geograf')) return subT.geography;
  if (s.includes('english') || s.includes('ingliz')) return subT.english;
  if (s.includes('uzbek') || s.includes('o\'zbek')) return subT.uzbek;
  if (s.includes('russian') || s.includes('rus')) return subT.russian;
  if (s.includes('literature') || s.includes('adabiyot')) return subT.literature;
  if (s.includes('art') || s.includes('tasviriy') || s.includes('izo')) return subT.art;
  if (s.includes('music') || s.includes('musiqa')) return subT.music;
  if (s.includes('sport') || s.includes('phys') || s.includes('jismoniy') || s.includes('fizra')) return subT.sport;
  if (s.includes('it') || s.includes('computer') || s.includes('informatika')) return subT.it;
  if (s.includes('technology') || s.includes('texnologiya')) return subT.technology;
  if (s.includes('mother') || s.includes('ona tili')) return subT.mother_tongue;
  if (s.includes('science') || s.includes('tabiiy') || s.includes('prirod')) return subT.science;

  return subject;
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lang') as Language || 'en';
    }
    return 'en';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });
  const t = translations[lang];
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscribers, setSubscribers] = useState<UserProfile[]>([]);
  const [step, setStep] = useState<'register' | 'profile' | 'config' | 'result' | 'admin'>('register');
  const [grades, setGrades] = useState<GradeConfig[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    if (user && profile && profile.lang !== lang) {
      updateDoc(doc(db, 'users', user.uid), { lang }).catch(err => {
        if (err instanceof Error && err.message.includes('permission-denied')) {
          console.warn('Silent failure updating language - rules might be strictly schema bound');
        }
      });
    }
  }, [lang, user, profile]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const path = `users/${firebaseUser.uid}`;
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setProfile(userData);
            if (userData.role === 'admin') {
              setStep('admin');
            } else {
              setStep('profile');
            }
          } else {
            setStep('register');
          }
        } catch (error) {
          // If offline, we might retry or just show error
          if (error instanceof Error && error.message.includes('offline')) {
            console.warn('Initial load failed: Client is offline. Firestore will retry automatically.');
          } else {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        setStep('register');
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') {
      const path = 'users';
      const unsubscribeUsers = onSnapshot(collection(db, path), (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data() as UserProfile);
        setSubscribers(users);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
      return () => unsubscribeUsers();
    }
  }, [profile]);

  const handleRegister = async (data: any) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    const newProfile: UserProfile = {
      ...data,
      id: user.uid,
      email: user.email!,
      role: user.email === 'rustamovfoziljon936@gmail.com' ? 'admin' : 'user',
      paymentStatus: 'unlimited',
      createdAt: Date.now(),
      lang: lang
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      if (newProfile.role === 'admin') {
        setStep('admin');
      } else {
        setStep('profile');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (profile?.role !== 'admin') return;
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success("User removed successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleStart = () => {
    setStep('config');
  };

  const handleGenerate = async () => {
    if (grades.length === 0 || teachers.length === 0) {
      toast.error(t.addAtLeastOne);
      return;
    }
    if (!profile) return;
    
    setIsLoading(true);
    try {
      // Deduplicate grades before sending to AI to ensure consistent coverage
      const uniqueGradesMap = new Map<number, GradeConfig>();
      grades.forEach(g => {
        if (!uniqueGradesMap.has(g.grade)) {
          uniqueGradesMap.set(g.grade, g);
        } else {
          // Merge subjects and take max numClasses
          const existing = uniqueGradesMap.get(g.grade)!;
          const mergedSubjects = [...existing.subjects];
          g.subjects.forEach(s => {
            if (!mergedSubjects.find(ms => ms.name.toLowerCase() === s.name.toLowerCase())) {
              mergedSubjects.push(s);
            }
          });
          uniqueGradesMap.set(g.grade, {
            ...existing,
            numClasses: Math.max(existing.numClasses, g.numClasses),
            subjects: mergedSubjects
          });
        }
      });
      const processedGrades = Array.from(uniqueGradesMap.values());

      const result = await generateSchedule(processedGrades, teachers, profile.country, profile.region, lang);
      
      if (!result || !result.schedule || result.schedule.length === 0) {
        throw new Error("AI generated an empty schedule. This might be due to complex constraints. Please try simplifying your grades or teachers.");
      }

      if (!validateSchedule(result.schedule)) {
        throw new Error("AI generated an invalid schedule format. Retrying recommended.");
      }

      // Recalculate stats locally
      const teacherHours: Record<string, number> = {};
      const gradeHours: Record<number, number> = {};
      result.schedule.forEach(entry => {
        teacherHours[entry.teacher] = (teacherHours[entry.teacher] || 0) + 1;
        gradeHours[entry.grade] = (gradeHours[entry.grade] || 0) + 1;
      });
      result.stats = { teacherHours, gradeHours };

      setScheduleResult(result);
      setStep('result');
      toast.success(t.genSuccess);
    } catch (error: any) {
      console.error("Schedule generation error:", error);
      const msg = error.message || "Unknown error occurred";
      toast.error(`${t.genError}: ${msg.substring(0, 100)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSchedule = (newSchedule: any[]) => {
    if (!scheduleResult) return;
    
    // Recalculate stats
    const teacherHours: Record<string, number> = {};
    const gradeHours: Record<number, number> = {};
    
    newSchedule.forEach(entry => {
      teacherHours[entry.teacher] = (teacherHours[entry.teacher] || 0) + 1;
      gradeHours[entry.grade] = (gradeHours[entry.grade] || 0) + 1;
    });

    setScheduleResult({
      ...scheduleResult,
      schedule: newSchedule,
      stats: {
        teacherHours,
        gradeHours
      }
    });
  };

  const handleReset = () => {
    if (profile?.role === 'admin') {
        setStep('admin');
    } else {
        setStep('profile');
    }
    setGrades([]);
    setTeachers([]);
    setScheduleResult(null);
    toast.info(t.appReset);
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Successfully logged in!");
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        toast.error("Popup blocked! Please allow popups for this site.");
      } else {
        toast.error(`Login failed: ${error.message || "Please check your internet connection and try again."}`);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsAuthLoading(true);
    try {
      await signInWithEmail(email, password);
      toast.success("Successfully logged in!");
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await signUpWithEmail(email, password);
          toast.success("Account created successfully!");
        } catch (signUpErr: any) {
          toast.error(signUpErr.message);
        }
      } else {
        toast.error(err.message);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 font-sans text-neutral-900 dark:text-neutral-50 selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-5xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-12"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none rotate-3 hover:rotate-0 transition-transform">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500 uppercase">{t.title}</h1>
              <p className="text-[10px] font-black text-blue-600/60 dark:text-blue-400/60 uppercase tracking-[0.2em]">Scheduling Engine v2.5 • Enterprise</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="rounded-2xl w-10 h-10 border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
            >
              {theme === 'light' ? <Moon className="w-5 h-5 text-neutral-600" /> : <Sun className="w-5 h-5 text-yellow-400" />}
            </Button>
            <div className="flex items-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl px-3 py-1 shadow-sm">
              <Languages className="w-4 h-4 text-neutral-400 mr-2" />
              <Select value={lang} onValueChange={(v: Language) => setLang(v)}>
                <SelectTrigger className="border-none shadow-none h-8 bg-transparent focus:ring-0 text-[10px] font-black uppercase tracking-widest w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-neutral-100 dark:border-neutral-800">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uz">O'zbek</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => logout()} 
                className="text-neutral-400 hover:text-red-500 font-bold uppercase text-[10px] tracking-widest px-4 h-10 rounded-2xl"
              >
                Sign Out
              </Button>
            )}
            {profile && scheduleResult && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-neutral-500 hover:text-red-500 rounded-full">
                <Trash2 className="w-4 h-4 mr-2" /> {t.resetAll}
              </Button>
            )}
            {profile?.role === 'admin' && step !== 'admin' && (
              <Button variant="outline" size="sm" onClick={() => setStep('admin')} className="rounded-full">
                Admin Panel
              </Button>
            )}
          </div>
        </motion.div>
        
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8">
            <Card className="w-full max-w-sm border-none shadow-2xl dark:shadow-blue-900/10 dark:bg-neutral-900 rounded-[2.5rem] overflow-hidden p-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="h-3 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-100 dark:border-blue-800 rotate-6 hover:rotate-0 transition-all duration-500">
                  <Zap className="w-10 h-10 text-blue-600 fill-blue-600" />
                </div>
                <CardTitle className="text-3xl font-black mb-3 tracking-tight dark:text-white uppercase leading-none">{t.title}</CardTitle>
                <CardDescription className="mb-10 text-neutral-400 font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                  Sun'iy intellekt yordamida maktab dars jadvalini <br /> bir necha soniyada yarating
                </CardDescription>

                <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t.email}</Label>
                    <Input 
                      type="email" 
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 font-bold text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t.password}</Label>
                    <Input 
                      type="password" 
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 font-bold text-sm"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full h-14 bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
                  >
                    {isAuthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.signInWithEmail}
                  </Button>
                </form>

                <div className="flex items-center space-x-4 mb-6">
                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 flex-1" />
                  <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{t.or}</span>
                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 flex-1" />
                </div>

                <Button 
                  onClick={handleLogin} 
                  type="button"
                  size="lg" 
                  disabled={isAuthLoading}
                  className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/20 group transition-all"
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t.signInWithGoogle} <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
                <p className="mt-8 text-[10px] font-bold text-neutral-400 uppercase tracking-widest opacity-50">Enterprise Edition v2.5</p>
              </div>
            </Card>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {step === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <RegistrationForm user={user} onSubmit={handleRegister} t={t} lang={lang} />
              </motion.div>
            )}

            {step === 'admin' && profile?.role === 'admin' && (
               <motion.div
                key="admin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <AdminDashboard 
                  subscribers={subscribers} 
                  onDeleteUser={handleDeleteUser} 
                  onStartScheduling={() => setStep('profile')}
                  profile={profile}
                  t={t} 
                />
              </motion.div>
            )}

            {step === 'profile' && profile && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ProfileView profile={profile} onStart={handleStart} t={t} />
              </motion.div>
            )}

            {step === 'config' && profile && (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ScheduleWizard 
                  grades={grades} 
                  setGrades={setGrades} 
                  teachers={teachers} 
                  setTeachers={setTeachers} 
                  onGenerate={handleGenerate}
                  isLoading={isLoading}
                  profile={profile}
                  t={t}
                  lang={lang}
                />
              </motion.div>
            )}

            {step === 'result' && scheduleResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ScheduleResultView 
                  result={scheduleResult} 
                  onBack={() => setStep('config')} 
                  onRegenerate={handleGenerate}
                  isLoading={isLoading}
                  onUpdateSchedule={handleUpdateSchedule}
                  allTeachers={teachers}
                  allGrades={grades}
                  profile={profile}
                  t={t}
                  lang={lang}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

function AdminDashboard({ 
  subscribers, 
  onDeleteUser, 
  onStartScheduling, 
  profile,
  t 
}: { 
  subscribers: UserProfile[], 
  onDeleteUser: (id: string) => void, 
  onStartScheduling: () => void,
  profile: UserProfile,
  t: any 
}) {
  return (
    <div className="space-y-6 text-neutral-900 dark:text-neutral-100">
      <div className="flex justify-between items-center bg-white dark:bg-neutral-900/80 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-neutral-500 font-medium text-sm">Manage subscribers and system settings</p>
        </div>
        <Button onClick={onStartScheduling} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold uppercase tracking-widest text-xs px-6 h-11">
          Open Scheduler <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm dark:bg-neutral-900/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider text-[10px] font-black text-neutral-400">Total Subscribers</CardDescription>
            <CardTitle className="text-3xl font-black text-neutral-900 dark:text-white">{subscribers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm dark:bg-neutral-900/50 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider text-[10px] font-black text-neutral-400">System Status</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-500 flex items-center">
              Active <CheckCircle2 className="ml-2 w-6 h-6" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-sm dark:bg-neutral-900/50 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-neutral-100 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
          <CardTitle>Subscriber List</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-neutral-50 dark:bg-neutral-950">
              <TableRow className="border-neutral-100 dark:border-neutral-800">
                <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">User</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Location</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Role</TableHead>
                <TableHead className="py-4 px-6 text-right text-[10px] font-black uppercase tracking-widest text-neutral-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((u) => (
                <TableRow key={u.id} className="border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-black text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                        {u.name[0]}{u.surname[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{u.name} {u.surname}</p>
                        <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-tight">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500 font-medium">{u.region}, {u.country}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDeleteUser(u.id)}
                      className="text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-lg"
                      disabled={u.role === 'admin'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RegistrationForm({ user, onSubmit, t, lang }: { user: any, onSubmit: (data: any) => void, t: any, lang: Language }) {
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    sex: 'other',
    country: '',
    region: '',
    jobTitle: 'Teacher'
  });

  const regions = formData.country ? COUNTRIES_REGIONS[formData.country] || [] : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.surname || !formData.country || !formData.region) {
      toast.error(t.fillAll);
      return;
    }
    onSubmit(formData);
  };

  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50 dark:bg-neutral-900 dark:shadow-none rounded-[2rem] overflow-hidden">
      <CardHeader className="space-y-1 pb-8 bg-neutral-50/50 dark:bg-neutral-950/50 border-b border-neutral-100 dark:border-neutral-800">
        <CardTitle className="text-3xl font-black tracking-tight dark:text-white uppercase">{t.welcome}</CardTitle>
        <CardDescription className="text-neutral-500 font-bold text-xs uppercase tracking-widest">{t.welcomeDesc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center mr-4 font-black text-blue-600 dark:text-blue-400 shadow-sm">
               {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 text-left">
               <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Logged in as</p>
               <p className="text-sm font-bold tracking-tight text-neutral-600 dark:text-neutral-300">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.firstName}</Label>
              <Input 
                id="name" 
                placeholder="John" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">{t.lastName}</Label>
              <Input 
                id="surname" 
                placeholder="Doe" 
                value={formData.surname} 
                onChange={e => setFormData({ ...formData, surname: e.target.value })} 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">{t.jobTitle}</Label>
              <Select value={formData.jobTitle} onValueChange={v => setFormData({ ...formData, jobTitle: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Director">{t.jobs.director}</SelectItem>
                  <SelectItem value="Vice principal">{t.jobs.vicePrincipal}</SelectItem>
                  <SelectItem value="Deputy director">{t.jobs.deputyDirector}</SelectItem>
                  <SelectItem value="Teacher">{t.jobs.teacher}</SelectItem>
                  <SelectItem value="Student">{t.jobs.student}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">{t.sex}</Label>
              <Select value={formData.sex} onValueChange={v => setFormData({ ...formData, sex: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t.genders.male}</SelectItem>
                  <SelectItem value="female">{t.genders.female}</SelectItem>
                  <SelectItem value="other">{t.genders.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">{t.country}</Label>
              <Select value={formData.country} onValueChange={v => setFormData({ ...formData, country: v, region: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder={t.country} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">{t.region}</Label>
              <Select value={formData.region} onValueChange={v => setFormData({ ...formData, region: v })} disabled={!formData.country}>
                <SelectTrigger>
                  <SelectValue placeholder={t.region} />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full h-12 text-lg font-medium bg-neutral-900 hover:bg-neutral-800 transition-all">
            {t.continue} <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileView({ profile, onStart, t }: { profile: UserProfile, onStart: () => void, t: any }) {
  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50 dark:bg-neutral-900 dark:shadow-none overflow-hidden rounded-[2rem]">
      <div className="h-32 bg-blue-600 dark:bg-blue-900 relative">
        <div className="absolute -bottom-10 left-8 w-24 h-24 bg-white dark:bg-neutral-800 rounded-3xl shadow-xl flex items-center justify-center border-4 border-white dark:border-neutral-800 overflow-hidden rotate-6">
          <User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <CardHeader className="pt-16 pb-8 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black tracking-tight dark:text-white uppercase leading-none">{profile.name} {profile.surname}</CardTitle>
            <CardDescription className="text-neutral-500 font-bold text-xs uppercase tracking-widest mt-2">{profile.email}</CardDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-[10px] uppercase font-black tracking-widest border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            {profile.jobTitle === 'Teacher' ? t.jobs.teacher : 
             profile.jobTitle === 'Director' ? t.jobs.director :
             profile.jobTitle === 'Vice principal' ? t.jobs.vicePrincipal :
             profile.jobTitle === 'Deputy director' ? t.jobs.deputyDirector :
             profile.jobTitle === 'Student' ? t.jobs.student : profile.jobTitle}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-10 pt-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-left">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.sex}</p>
            <p className="text-neutral-900 dark:text-neutral-100 font-bold capitalize">
              {profile.sex === 'male' ? t.genders.male : 
               profile.sex === 'female' ? t.genders.female : t.genders.other}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.country}</p>
            <p className="text-neutral-900 dark:text-neutral-100 font-bold">{profile.country}</p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.region}</p>
            <p className="text-neutral-900 dark:text-neutral-100 font-bold">{profile.region}</p>
          </div>
        </div>
        
        <Separator className="bg-neutral-100 dark:bg-neutral-800" />
        <div className="flex flex-col items-center space-y-6">
          <p className="text-center text-neutral-400 font-bold text-xs uppercase tracking-widest leading-relaxed max-w-sm">
            {t.profileReady}
          </p>
          <Button onClick={onStart} size="lg" className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/20 text-xs transition-all hover:scale-[1.02] active:scale-95">
            {t.startScheduling} <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleWizard({ 
  grades, 
  setGrades, 
  teachers, 
  setTeachers, 
  onGenerate,
  isLoading,
  profile,
  t,
  lang
}: { 
  grades: GradeConfig[], 
  setGrades: React.Dispatch<React.SetStateAction<GradeConfig[]>>, 
  teachers: Teacher[], 
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>, 
  onGenerate: () => void,
  isLoading: boolean,
  profile: UserProfile,
  t: any,
  lang: Language
}) {
  const [activeTab, setActiveTab] = useState('grades');
  const [isSuggesting, setIsSuggesting] = useState(false);

  const addGrade = async () => {
    const nextGrade = grades.length > 0 ? Math.max(...grades.map(g => g.grade)) + 1 : 1;
    if (nextGrade > 11) {
      toast.error(t.max11);
      return;
    }
    
    const newGrade: GradeConfig = { grade: nextGrade, numClasses: 1, subjects: [] };
    setGrades([...grades, newGrade]);

    // Auto-suggest subjects
    try {
      toast.info(`${t.addSubject}: ${t.grade} ${nextGrade}...`);
      const suggested = await suggestSubjects(profile.country, profile.region, nextGrade, lang);
      setGrades(prev => prev.map(g => g.grade === nextGrade ? { ...g, subjects: suggested } : g));
      toast.success(`${t.addSubject} (${suggested.length})`);
    } catch (error) {
      console.error(error);
      toast.error(t.addSubject);
    }
  };

  const handleSuggestTeachers = async () => {
    if (grades.length === 0) {
      toast.error(t.addGradesFirst);
      return;
    }

    setIsSuggesting(true);
    try {
      toast.info(`${t.suggestTeachers}...`);
      const suggested = await suggestTeachers(grades, profile?.country || '', profile?.region || '', lang);
      setTeachers(suggested);
      toast.success(`${t.suggestTeachers} (${suggested.length})`);
    } catch (error) {
      console.error(error);
      toast.error(t.suggestTeachers);
    } finally {
      setIsSuggesting(false);
    }
  };

  const removeGrade = (gradeNum: number) => {
    setGrades(grades.filter(g => g.grade !== gradeNum));
  };

  const updateGrade = (gradeNum: number, updates: Partial<GradeConfig>) => {
    setGrades(grades.map(g => g.grade === gradeNum ? { ...g, ...updates } : g));
  };

  const addSubject = (gradeNum: number) => {
    setGrades(grades.map(g => {
      if (g.grade === gradeNum) {
        return { ...g, subjects: [...g.subjects, { name: '', hoursPerWeek: 1 }] };
      }
      return g;
    }));
  };

  const updateSubject = (gradeNum: number, index: number, updates: Partial<{ name: string, hoursPerWeek: number }>) => {
    setGrades(grades.map(g => {
      if (g.grade === gradeNum) {
        const newSubjects = [...g.subjects];
        newSubjects[index] = { ...newSubjects[index], ...updates };
        return { ...g, subjects: newSubjects };
      }
      return g;
    }));
  };

  const removeSubject = (gradeNum: number, index: number) => {
    setGrades(grades.map(g => {
      if (g.grade === gradeNum) {
        return { ...g, subjects: g.subjects.filter((_, i) => i !== index) };
      }
      return g;
    }));
  };

  const addTeacher = () => {
    setTeachers([...teachers, { 
      id: crypto.randomUUID(), 
      name: '', 
      preferredSubjects: [], 
      assignedClasses: [], 
      targetHours: 0 
    }]);
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setTeachers(teachers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTeacher = (id: string) => {
    setTeachers(teachers.filter(t => t.id !== id));
  };

  const [editingTeacherClasses, setEditingTeacherClasses] = useState<string | null>(null);

  const allClassLabels = useMemo(() => {
    const labelsSet = new Set<string>();
    grades.forEach(g => {
      for (let i = 0; i < g.numClasses; i++) {
        labelsSet.add(`${g.grade} ${String.fromCharCode(65 + i)}`);
      }
    });
    return Array.from(labelsSet).sort();
  }, [grades]);

  const getTeacherLoad = (teacher: Teacher) => {
    let load = 0;
    const assignedClasses = teacher.assignedClasses || [];
    const preferredSubjects = teacher.preferredSubjects || [];
    
    assignedClasses.forEach(clsLabel => {
      const gradeNum = parseInt(clsLabel.split(' ')[0]);
      const grade = grades.find(g => g.grade === gradeNum);
      if (grade && grade.subjects) {
        grade.subjects.forEach(sub => {
          if (preferredSubjects.includes(sub.name)) {
            load += sub.hoursPerWeek;
          }
        });
      }
    });
    return load;
  };

  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50 dark:bg-neutral-900 dark:shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">{t.configTitle}</CardTitle>
        <CardDescription className="dark:text-neutral-400">{t.configDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full bg-neutral-100 dark:bg-neutral-950 p-1.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-800 shadow-inner">
            <TabsTrigger value="grades" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-lg transition-all font-black text-[10px] uppercase tracking-[0.15em]">
              <School className="w-4 h-4 mr-2" /> {t.gradesAndSubjects}
            </TabsTrigger>
            <TabsTrigger value="lessons" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-lg transition-all font-black text-[10px] uppercase tracking-[0.15em]">
              <Calendar className="w-4 h-4 mr-2" /> {t.suggestedLessons}
            </TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-lg transition-all font-black text-[10px] uppercase tracking-[0.15em]">
              <Users className="w-4 h-4 mr-2" /> {t.teachers}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{t.grade} {t.configTitle}</h3>
              <Button onClick={addGrade} variant="outline" size="sm" className="rounded-full">
                <Plus className="w-4 h-4 mr-1" /> {t.addGrade}
              </Button>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {grades.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                    <p className="text-neutral-400">{t.noGrades}</p>
                  </div>
                )}
                {grades.map((g) => (
                  <Card key={g.grade} className="border-neutral-100 dark:border-neutral-800 shadow-none bg-neutral-50/50 dark:bg-neutral-950/50">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center space-x-4">
                        <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-sm font-bold bg-white dark:bg-neutral-800 shadow-sm">
                          {g.grade}
                        </Badge>
                        <div className="space-y-1">
                          <CardTitle className="text-base font-bold">{t.grade} {g.grade}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{t.classes}:</Label>
                            <Input 
                              type="number" 
                              className="h-7 w-16 text-xs bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800" 
                              value={g.numClasses} 
                              onChange={e => updateGrade(g.grade, { numClasses: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeGrade(g.grade)} className="text-neutral-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.subject}</Label>
                        <Button variant="ghost" size="sm" onClick={() => addSubject(g.grade)} className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700">
                          <Plus className="w-3 h-3 mr-1" /> {t.addSubject}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {g.subjects.map((s, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <Input 
                              placeholder={t.subject} 
                              className="h-9 text-sm flex-1 bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 rounded-lg px-3" 
                              value={s.name} 
                              onChange={e => updateSubject(g.grade, idx, { name: e.target.value })}
                            />
                            <div className="flex items-center space-x-2 w-36">
                              <Input 
                                type="number" 
                                placeholder={t.hrs} 
                                className="h-9 text-sm w-16 bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 rounded-lg text-center" 
                                value={s.hoursPerWeek} 
                                onChange={e => updateSubject(g.grade, idx, { hoursPerWeek: parseInt(e.target.value) || 1 })}
                              />
                               <span className="text-[10px] text-neutral-400 font-black uppercase shrink-0 tracking-tighter">{t.hrsPerWeek}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeSubject(g.grade, idx)} className="h-9 w-9 text-neutral-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lessons" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold tracking-tight">{t.suggestedLessons}</h3>
              <Button 
                onClick={async () => {
                  if (grades.length === 0) {
                    toast.error(t.addGrade);
                    return;
                  }
                  setIsSuggesting(true);
                  try {
                    for (const g of grades) {
                      toast.info(`${t.addSubject}: Grade ${g.grade}...`);
                      const suggested = await suggestSubjects(profile.country, profile.region, g.grade, lang);
                      setGrades(prev => prev.map(grad => grad.grade === g.grade ? { ...grad, subjects: suggested } : grad));
                    }
                    toast.success(t.suggestedLessons);
                  } catch (error) {
                    toast.error(t.suggestedLessons);
                  } finally {
                    setIsSuggesting(false);
                  }
                }} 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-900/10"
                disabled={isSuggesting}
              >
                {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1 transition-transform group-hover:rotate-90" />}
                {t.suggestedLessons} (AI)
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {grades.map(g => (
                  <div key={g.grade} className="border border-neutral-100 dark:border-neutral-800 rounded-2xl p-5 bg-white dark:bg-neutral-900/40 shadow-sm">
                    <h4 className="font-bold text-sm mb-4 flex items-center">
                      <Badge variant="outline" className="mr-3 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-black px-2.5">{g.grade}</Badge>
                      <span className="uppercase tracking-tight">{t.gradesAndSubjects.split(' ')[0]} {g.grade}</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {g.subjects.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-950/50 px-3 py-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 transition-colors hover:border-blue-100 dark:hover:border-blue-900/40">
                          <span className="text-[11px] font-bold truncate text-neutral-600 dark:text-neutral-300">{s.name}</span>
                          <span className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded ml-2 shrink-0">{s.hoursPerWeek}h</span>
                        </div>
                      ))}
                      {g.subjects.length === 0 && (
                        <div className="col-span-full py-8 text-center text-xs text-neutral-400 font-bold uppercase tracking-widest bg-neutral-50/30 dark:bg-neutral-950/20 rounded-xl border border-dashed border-neutral-100 dark:border-neutral-800">
                          {t.noSubjects}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {grades.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                    <p className="text-neutral-400">{t.addGradesFirst}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="teachers" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{t.teachers}</h3>
              <div className="flex space-x-2">
                <Button onClick={handleSuggestTeachers} variant="outline" size="sm" className="rounded-full" disabled={isSuggesting}>
                  {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} 
                  {t.suggestTeachers}
                </Button>
                <Button onClick={addTeacher} variant="outline" size="sm" className="rounded-full">
                  <Plus className="w-4 h-4 mr-1" /> {t.addTeacher}
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {teachers.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                    <p className="text-neutral-400">No teachers added yet.</p>
                  </div>
                )}
                {teachers.map((t_item, index) => {
                  const currentLoad = getTeacherLoad(t_item);
                  const isOverloaded = t_item.targetHours && currentLoad > t_item.targetHours;

                  return (
                    <motion.div
                      key={t_item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-neutral-900/50 overflow-hidden">
                        <div className={`h-1 w-full ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                          <div className="flex-1 mr-4 space-y-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500">
                                {t_item.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <Input 
                                placeholder={t.teacher} 
                                className="h-9 font-bold flex-1 bg-transparent border-none focus-visible:ring-0 px-0 text-base" 
                                value={t_item.name} 
                                onChange={e => updateTeacher(t_item.id, { name: e.target.value })}
                              />
                              <div className="flex items-center space-x-2 shrink-0 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 rounded-md border border-neutral-100 dark:border-neutral-700">
                                <Label className="text-[10px] uppercase font-black text-neutral-400">{t.target}:</Label>
                                <Input 
                                  type="number" 
                                  className="h-6 w-12 text-xs border-none bg-transparent focus-visible:ring-0 p-0 text-center font-bold" 
                                  value={t_item.targetHours} 
                                  onChange={e => updateTeacher(t_item.id, { targetHours: parseInt(e.target.value) || 0 })}
                                />
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Badge variant={isOverloaded ? "destructive" : "secondary"} className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">
                                {t.load}: {currentLoad} {t.hrsPerWeek}
                              </Badge>
                              {t_item.targetHours! > 0 && (
                                <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${Math.min((currentLoad / t_item.targetHours!) * 100, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeTeacher(t_item.id)} className="text-neutral-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.subject}</Label>
                            <Input 
                              placeholder={t.teacherPlaceholder} 
                              className="h-8 text-xs bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-700" 
                              value={t_item.preferredSubjects.join(', ')} 
                              onChange={e => updateTeacher(t_item.id, { preferredSubjects: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.assignedClasses}</Label>
                              <Button variant="link" size="sm" onClick={() => setEditingTeacherClasses(t_item.id)} className="h-4 p-0 text-[10px] font-bold text-blue-600">
                                {t.edit}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(t_item.assignedClasses || []).length === 0 ? (
                                <span className="text-[10px] text-neutral-400 italic bg-neutral-50 dark:bg-neutral-800 px-2 py-0.5 rounded uppercase font-bold tracking-tighter">{t.noClassesAssigned}</span>
                              ) : (
                                (t_item.assignedClasses || []).map(cls => (
                                  <Badge key={cls} variant="outline" className="text-[10px] px-2 py-0 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 font-bold">
                                    {cls}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Class Assignment Dialog */}
            <Dialog open={!!editingTeacherClasses} onOpenChange={(open) => !open && setEditingTeacherClasses(null)}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t.assignedClasses}</DialogTitle>
                  <DialogDescription>
                    {t.teacher}: {teachers.find(t => t.id === editingTeacherClasses)?.name || ''}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[300px] mt-4 pr-4">
                  <div className="grid grid-cols-3 gap-2">
                    {allClassLabels.map(cls => {
                      const teacher = teachers.find(t => t.id === editingTeacherClasses);
                      const isSelected = teacher?.assignedClasses?.includes(cls);
                      
                      return (
                        <Button
                          key={cls}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-10 text-xs"
                          onClick={() => {
                            if (!teacher) return;
                            const currentClasses = teacher.assignedClasses || [];
                            const newClasses = isSelected
                              ? currentClasses.filter(c => c !== cls)
                              : [...currentClasses, cls];
                            updateTeacher(teacher.id, { assignedClasses: newClasses });
                          }}
                        >
                          {cls}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                  <Button onClick={() => setEditingTeacherClasses(null)}>{t.done}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-between"
        >
          <div className="text-white">
            <h4 className="font-black uppercase tracking-tight text-lg leading-tight">{t.readyToBuild}</h4>
            <p className="text-blue-100 text-xs font-bold uppercase tracking-widest opacity-80">{t.allConstraintsSet}</p>
          </div>
          <Button 
            onClick={onGenerate} 
            disabled={isLoading}
            size="lg" 
            className="px-10 h-14 bg-white text-blue-600 hover:bg-neutral-50 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 group"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" /> {t.generating}...
              </>
            ) : (
              <>
                {t.generateSchedule} <Zap className="ml-3 w-5 h-5 group-hover:scale-125 transition-transform text-yellow-500 fill-yellow-500" />
              </>
            )}
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
}

function ScheduleResultView({ 
  result, 
  onBack, 
  onRegenerate, 
  isLoading,
  onUpdateSchedule,
  allTeachers,
  allGrades,
  profile,
  t,
  lang
}: { 
  result: ScheduleResult, 
  onBack: () => void, 
  onRegenerate: () => void, 
  isLoading: boolean,
  onUpdateSchedule: (newSchedule: any[]) => void,
  allTeachers: Teacher[],
  allGrades: GradeConfig[],
  profile: UserProfile | null,
  t: any,
  lang: Language
}) {
  const [activeTab, setActiveTab] = useState('cards');
  const [refreshKey, setRefreshKey] = useState(0);

  const [editingSlot, setEditingSlot] = useState<{ day: string, slot: string, cls: string, grade: number, className: string } | null>(null);
  const [editData, setEditData] = useState({ subject: '', teacher: '' });

  // Map day names to translated versions
  const dayNameMap: Record<string, string> = useMemo(() => ({
    "Monday": t.days.monday,
    "Tuesday": t.days.tuesday,
    "Wednesday": t.days.wednesday,
    "Thursday": t.days.thursday,
    "Friday": t.days.friday,
    "Saturday": t.days.saturday,
    "Sunday": t.days.sunday,
  }), [t]);

  // Helper to generate expected class labels for all configured grades
  const expectedClassNames = useMemo(() => {
    const namesSet = new Set<string>();
    [...allGrades].sort((a, b) => a.grade - b.grade).forEach(g => {
      for (let i = 0; i < g.numClasses; i++) {
        const label = String.fromCharCode(65 + i); // A, B, C...
        namesSet.add(`${g.grade} ${label}`);
      }
    });
    return Array.from(namesSet);
  }, [allGrades]);

  const days = useMemo(() => ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], []);

  const normalizeT = normalizeTime;
  
  const classNames = useMemo(() => {
    if (expectedClassNames.length > 0) return expectedClassNames;
    return Array.from(new Set(result.schedule.map(e => `${e.grade} ${e.className}`))).sort();
  }, [expectedClassNames, result.schedule]);

  const DEFAULT_SLOTS = [
    "08:00-08:45",
    "08:50-09:35",
    "09:40-10:25",
    "10:30-11:15",
    "11:20-12:05",
    "12:10-12:55",
    "13:00-13:45",
    "13:50-14:35",
  ];

  // Get all unique time slots plus default ones - Robustly sorted and normalized
  const timeSlots = useMemo(() => {
    const rawSlots = [
      ...DEFAULT_SLOTS,
      ...result.schedule.map(e => `${e.startTime}-${e.endTime}`)
    ];
    
    const normalized = Array.from(new Set(rawSlots.filter(s => s.includes('-')).map(slot => {
      const [s, e] = slot.split('-');
      return `${normalizeT(s)}-${normalizeT(e)}`;
    })));
    
    return normalized.sort((a, b) => {
      const aStart = a.split('-')[0].replace(/\D/g, '').padStart(4, '0');
      const bStart = b.split('-')[0].replace(/\D/g, '').padStart(4, '0');
      return aStart.localeCompare(bStart);
    });
  }, [result.schedule]);

  // Robust matching helper
  const isMatch = isLessonMatch;

  const handleEditCell = (day: string, slot: string, clsLabel: string) => {
    const entry = result.schedule.find(e => isMatch(e as any, day, slot, clsLabel));
    
    const labelParts = clsLabel.split(' ');
    if (labelParts.length < 2) return;
    const gradeNum = parseInt(labelParts[0]);
    const classNameVal = labelParts.slice(1).join(' ');

    setEditingSlot({ day, slot, cls: clsLabel, grade: gradeNum, className: classNameVal });
    setEditData({ 
      subject: entry?.subject || '', 
      teacher: entry?.teacher || '' 
    });
  };

  const handleSaveEdit = () => {
    if (!editingSlot) return;

    const [start, end] = editingSlot.slot.split('-');
    const newSchedule = [...result.schedule];
    const index = newSchedule.findIndex(e => isMatch(e as any, editingSlot.day, editingSlot.slot, editingSlot.cls));

    if (index !== -1) {
      if (editData.subject === '' && editData.teacher === '') {
        // Remove entry
        newSchedule.splice(index, 1);
      } else {
        // Update entry
        newSchedule[index] = {
          ...newSchedule[index],
          subject: editData.subject,
          teacher: editData.teacher
        };
      }
    } else if (editData.subject !== '') {
      // Add new entry
      newSchedule.push({
        day: editingSlot.day,
        startTime: start,
        endTime: end,
        grade: editingSlot.grade,
        className: editingSlot.className,
        subject: editData.subject,
        teacher: editData.teacher
      });
    }

    onUpdateSchedule(newSchedule);
    setEditingSlot(null);
    toast.success(t.scheduleUpdated);
  };

  // Get available subjects for the specific grade being edited
  const availableSubjects = editingSlot 
    ? allGrades.find(g => g.grade === editingSlot.grade)?.subjects.map(s => s.name) || []
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-full">
          <ChevronLeft className="mr-2 w-4 h-4" /> {t.backToConfig}
        </Button>
        <div className="flex items-center space-x-3">
          <Badge variant={result.conflicts.length > 0 ? "destructive" : "secondary"} className="rounded-xl px-4 py-1.5 text-[10px] uppercase font-black tracking-widest h-10 flex items-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800">
            {result.conflicts.length} {t.conflicts}
          </Badge>
          <Button variant="outline" className="rounded-2xl h-10 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-bold uppercase text-[10px] tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all px-6" onClick={onRegenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="mr-2 w-4 h-4 text-yellow-500 fill-yellow-500" />}
            {t.regenerate}
          </Button>
          <Button variant="outline" className="rounded-2xl h-10 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-bold uppercase text-[10px] tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all px-6" onClick={() => exportScheduleToExcel(result.schedule)}>
            <Download className="mr-2 w-4 h-4 text-blue-600" /> {t.downloadExcel}
          </Button>
          <Button variant="outline" className="rounded-2xl h-10 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-bold uppercase text-[10px] tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all px-6" onClick={() => window.print()}>
            <CheckCircle2 className="mr-2 w-4 h-4 text-emerald-500" /> {t.printSchedule}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-2xl shadow-blue-500/10 overflow-hidden bg-white dark:bg-neutral-900">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
          <CardHeader className="bg-neutral-50/50 dark:bg-neutral-950/50 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex justify-between items-end">
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight text-neutral-900 dark:text-white">{t.schoolScheduleGrid}</CardTitle>
                <CardDescription className="text-neutral-400 font-bold text-[10px] uppercase tracking-widest mt-1">{t.editLessonDesc}</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.total}</p>
                <p className="text-2xl font-black text-blue-600 leading-none">{result.schedule.length}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs key={refreshKey} value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6 pt-6">
                <TabsList className="bg-neutral-100 dark:bg-neutral-950 p-1.5 rounded-2xl border border-neutral-200/50 dark:border-neutral-800 shadow-inner w-full sm:w-auto">
                  <TabsTrigger value="cards" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest px-6">
                    <LayoutGrid className="w-4 h-4 mr-2" /> {t.classView}
                  </TabsTrigger>
                  <TabsTrigger value="grid" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest px-6">
                    <Calendar className="w-4 h-4 mr-2" /> {t.gridView}
                  </TabsTrigger>
                  <TabsTrigger value="list" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-900 data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest px-6">
                    <List className="w-4 h-4 mr-2" /> {t.listView}
                  </TabsTrigger>
                  <TabsTrigger value="conflicts" className="rounded-xl data-[state=active]:bg-red-600 dark:data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-black text-[10px] uppercase tracking-widest px-6">
                    <AlertCircle className="w-4 h-4 mr-2" /> {t.conflicts}
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="cards" className="p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {classNames.map(cls => {
                    const classEntries = result.schedule.filter(e => isLessonMatch(e as any, e.day, `${e.startTime}-${e.endTime}`, cls));
                    return (
                      <Card key={cls} className="border-none shadow-sm dark:bg-neutral-950 overflow-hidden outline outline-1 outline-neutral-100 dark:outline-neutral-800">
                        <CardHeader className="bg-neutral-50/50 dark:bg-neutral-900/20 py-4 px-6 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-xl font-black uppercase tracking-tight text-blue-600 dark:text-blue-400">
                              {cls}
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-white dark:bg-neutral-900">
                              {classEntries.length} {t.total} {t.hrs.toLowerCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y divide-neutral-50 dark:divide-neutral-900">
                            {days.map(day => {
                              const dayEntries = classEntries.filter(e => {
                                return getCanonicalDay(e.day) === getCanonicalDay(day);
                              });

                              return (
                                <div key={day} className="p-0">
                                  <div className="bg-neutral-50/30 dark:bg-neutral-900/10 px-6 py-2 border-b border-neutral-100 dark:border-neutral-900">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                                      {dayNameMap[day] || day}
                                    </p>
                                  </div>
                                  <div className="divide-y divide-neutral-50 dark:divide-neutral-900">
                                    {dayEntries.length > 0 ? (
                                      dayEntries.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((entry, idx) => {
                                        const color = getSubjectColor(entry.subject);
                                        return (
                                          <div 
                                            key={idx} 
                                            className="flex items-center px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors group cursor-pointer"
                                            onClick={() => handleEditCell(day, entry.startTime + "-" + entry.endTime, cls)}
                                          >
                                            <div className="w-16 shrink-0">
                                              <p className="text-xs font-black font-mono text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors">
                                                {entry.startTime}
                                              </p>
                                            </div>
                                            <div className={`ml-4 flex-1 px-4 py-2 rounded-2xl border shadow-sm transition-all group-hover:shadow-md ${color}`}>
                                              <div className="flex justify-between items-center">
                                                <p className="text-xs font-black uppercase tracking-tighter flex items-center">
                                                  <BookOpen className="w-3 h-3 mr-2 opacity-60 shrink-0" />
                                                  {localizeSubject(entry.subject, t)}
                                                </p>
                                                <div className="flex items-center space-x-2 text-[10px] font-bold opacity-60">
                                                  <Clock className="w-3 h-3" />
                                                  <span>{entry.startTime}-{entry.endTime}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center mt-1 text-[10px] font-bold opacity-70">
                                                <User className="w-3 h-3 mr-2 opacity-50 shrink-0" />
                                                <span className="truncate">{entry.teacher}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="px-6 py-8 text-center bg-neutral-50/20 dark:bg-neutral-900/5">
                                        <p className="text-[10px] font-black uppercase tracking-tight text-neutral-300">
                                          {t.noLessonsScheduled}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="grid" className="p-6">
                <div className="overflow-x-auto border border-neutral-100 dark:border-neutral-800 rounded-2xl shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-950">
                        <th className="border border-neutral-100 dark:border-neutral-800 p-3 text-left bg-neutral-100/50 dark:bg-neutral-950 w-24 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.kun}</th>
                        <th className="border border-neutral-100 dark:border-neutral-800 p-3 text-center bg-neutral-100/50 dark:bg-neutral-950 w-12 text-[10px] font-black uppercase tracking-widest text-neutral-400">#</th>
                        <th className="border border-neutral-100 dark:border-neutral-800 p-3 text-center bg-neutral-100/50 dark:bg-neutral-950 w-32 text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.vaqt}</th>
                        {classNames.map(cls => (
                          <th key={cls} className="border border-neutral-200 dark:border-neutral-800 p-3 text-center bg-blue-600 dark:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] min-w-[150px] shadow-inner">
                            {cls}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const daySlots = timeSlots;
                        
                        // Local cache for speed in heavy grids
                        const daySchedule = result.schedule.filter(e => {
                          return getCanonicalDay(e.day) === getCanonicalDay(day);
                        });

                        return daySlots.map((slot, slotIdx) => {
                          const slotParts = slot.split('-');
                          const start = slotParts[0] || '';
                          const end = slotParts[1] || '';
                          
                          return (
                            <tr key={`${day}-${slot}`} className={slotIdx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-50/50 dark:bg-neutral-800/20"}>
                              {slotIdx === 0 && (
                                <td 
                                  className="border border-neutral-200 dark:border-neutral-800 p-2 font-black bg-neutral-100 dark:bg-neutral-950 text-center align-middle text-[10px] uppercase tracking-widest text-neutral-500" 
                                  rowSpan={daySlots.length}
                                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: '40px' }}
                                >
                                  {dayNameMap[day] || day}
                                </td>
                              )}
                              <td className="border border-neutral-100 dark:border-neutral-800 p-2 text-center font-black text-[10px] text-neutral-400 bg-white/30 dark:bg-neutral-900/30">{slotIdx + 1}</td>
                              <td className="border border-neutral-100 dark:border-neutral-800 p-2 text-center text-[9px] font-black text-neutral-500 bg-white/30 dark:bg-neutral-900/30 tracking-tighter w-24">{start}-{end}</td>
                              {classNames.map(cls => {
                                const entry = daySchedule.find(e => isMatch(e as any, day, slot, cls));
                                const colorClass = entry ? getSubjectColor(entry.subject || '') : '';
                                return (
                                  <td 
                                    key={cls} 
                                    className="border border-neutral-100 dark:border-neutral-800 p-1 relative min-w-[140px] group cursor-pointer hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all"
                                    onClick={() => handleEditCell(day, slot, cls)}
                                  >
                                    {entry ? (
                                      <div className={`p-2.5 rounded-xl border shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] active:scale-95 ${colorClass}`}>
                                        <div className="text-[10px] font-black uppercase tracking-tighter mb-1 select-none flex items-center">
                                          <BookOpen className="w-3 h-3 mr-1 opacity-60" />
                                          <span className="truncate">{localizeSubject(entry.subject || '', t)}</span>
                                        </div>
                                        <div className="flex items-center text-[9px] font-bold opacity-70">
                                          <User className="w-2.5 h-2.5 mr-1 opacity-50 shrink-0" />
                                          <span className="truncate">{entry.teacher}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="h-12 flex items-center justify-center border-2 border-dashed border-neutral-50 dark:border-neutral-800 rounded-xl group-hover:border-blue-100/50 transition-colors">
                                        <Plus className="w-3 h-3 text-neutral-200 dark:text-neutral-800 group-hover:text-blue-300" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="list" className="p-6">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.kun}</TableHead>
                        <TableHead>{t.vaqt}</TableHead>
                        <TableHead>{t.class}</TableHead>
                        <TableHead>{t.subject}</TableHead>
                        <TableHead>{t.teacher}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.schedule.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{dayNameMap[entry.day] || entry.day}</TableCell>
                          <TableCell className="text-xs text-neutral-500">{entry.startTime} - {entry.endTime}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{entry.grade} {entry.className}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{localizeSubject(entry.subject, t)}</TableCell>
                          <TableCell className="text-neutral-600">{entry.teacher}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="lessons" className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classNames.map(cls => {
                    const classEntries = result.schedule.filter(e => {
                      return `${e.grade} ${e.className}` === cls || 
                             e.className === cls.split(' ').pop();
                    });

                    // Count hours per subject
                    const subjectCounts: Record<string, number> = {};
                    classEntries.forEach(e => {
                      subjectCounts[e.subject] = (subjectCounts[e.subject] || 0) + 1;
                    });

                    return (
                      <Card key={cls} className="border-neutral-200 shadow-none bg-neutral-50/20">
                        <CardHeader className="p-4 bg-neutral-50 border-b">
                          <CardTitle className="text-sm font-bold flex items-center justify-between">
                            {cls}
                            <Badge variant="secondary" className="text-xs">
                              {classEntries.length} {t.total}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y divide-neutral-100">
                            {Object.entries(subjectCounts).length > 0 ? (
                              Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).map(([subject, count]) => (
                                <div key={subject} className="flex justify-between items-center p-3 hover:bg-neutral-50 transition-colors">
                                  <span className="text-xs font-medium text-neutral-700">{localizeSubject(subject, t)}</span>
                                  <Badge variant="outline" className="text-[10px] font-bold">
                                    {count} {t.hrsPerWeek}
                                  </Badge>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-xs text-neutral-400">
                                {t.noLessonsScheduled}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="conflicts" className="p-6">
                <div className="space-y-4">
                  {result.conflicts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                      <p>{t.noConflicts}</p>
                    </div>
                  ) : (
                    result.conflicts.map((conflict, idx) => (
                      <div key={idx} className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                        <div className="flex items-center text-red-700 font-semibold">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {conflict.type.replace('_', ' ').toUpperCase()}
                        </div>
                        <p className="text-sm text-red-600">{conflict.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingSlot} onOpenChange={(open) => !open && setEditingSlot(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t.editLesson}</DialogTitle>
              <DialogDescription>
                {editingSlot ? `${dayNameMap[editingSlot.day] || editingSlot.day}, ${editingSlot.slot} - ${editingSlot.cls}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subject" className="text-right">
                  {t.subject}
                </Label>
                <div className="col-span-3">
                  <Select value={editData.subject} onValueChange={(v) => setEditData(prev => ({ ...prev, subject: v }))}>
                    <SelectTrigger id="subject">
                      <SelectValue placeholder={t.subject} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t.none}</SelectItem>
                      {availableSubjects.map(s => (
                        <SelectItem key={s} value={s}>{localizeSubject(s, t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teacher" className="text-right">
                  {t.teacher}
                </Label>
                <div className="col-span-3">
                  <Select value={editData.teacher} onValueChange={(v) => setEditData(prev => ({ ...prev, teacher: v }))}>
                    <SelectTrigger id="teacher">
                      <SelectValue placeholder={t.teacher} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t.none}</SelectItem>
                      {allTeachers.map(t_item => (
                        <SelectItem key={t_item.id} value={t_item.name}>{t_item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingSlot(null)}>{t.cancel}</Button>
              <Button type="button" onClick={handleSaveEdit}>{t.saveChanges}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg shadow-neutral-200/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{t.teacherStats}</CardTitle>
              <CardDescription>{t.totalHoursPerWeek}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {Object.entries(result.stats?.teacherHours || {}).map(([name, hours]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-700">{name}</span>
                      <Badge variant="secondary">{hours}{t.hrs.toLowerCase().charAt(0)}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-neutral-200/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">{t.gradeStats}</CardTitle>
              <CardDescription>{t.totalHoursPerWeek}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {Object.entries(result.stats?.gradeHours || {}).map(([grade, hours]) => (
                    <div key={grade} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-700">{t.grade} {grade}</span>
                      <Badge variant="secondary">{hours}{t.hrs.toLowerCase().charAt(0)}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
