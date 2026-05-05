import React, { useState, useMemo } from 'react';
import { UserProfile, GradeConfig, Teacher, ScheduleResult } from './types';
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
import { User, School, Users, Calendar, AlertCircle, CheckCircle2, Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Download, Languages } from 'lucide-react';
import { generateSchedule, suggestSubjects, suggestTeachers } from './lib/gemini';
import { exportScheduleToExcel } from './lib/excel';
import { COUNTRIES, COUNTRIES_REGIONS } from './constants';
import { translations, Language } from './translations';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];
  const [step, setStep] = useState<'register' | 'profile' | 'config' | 'result'>('register');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [grades, setGrades] = useState<GradeConfig[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleRegister = (data: UserProfile) => {
    setProfile(data);
    setStep('profile');
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
      const result = await generateSchedule(grades, teachers, profile.country, profile.region, lang);
      setScheduleResult(result);
      setStep('result');
      toast.success(t.genSuccess);
    } catch (error) {
      console.error(error);
      toast.error(t.genError);
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
    setStep('register');
    setProfile(null);
    setGrades([]);
    setTeachers([]);
    setScheduleResult(null);
    toast.info(t.appReset);
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
              <Calendar className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-white border border-neutral-200 rounded-full px-2 py-1 shadow-sm mr-2">
              <Languages className="w-4 h-4 text-neutral-400 mr-2 ml-1" />
              <Select value={lang} onValueChange={(v: Language) => setLang(v)}>
                <SelectTrigger className="border-none shadow-none h-7 bg-transparent focus:ring-0 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uz">O'zbek</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {profile && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-neutral-500 hover:text-red-500 rounded-full">
                <Trash2 className="w-4 h-4 mr-2" /> {t.resetAll}
              </Button>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <RegistrationForm onSubmit={handleRegister} t={t} lang={lang} />
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
                t={t}
                lang={lang}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

function RegistrationForm({ onSubmit, t, lang }: { onSubmit: (data: UserProfile) => void, t: any, lang: Language }) {
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    surname: '',
    email: '',
    sex: 'other',
    country: '',
    region: '',
    jobTitle: 'Teacher'
  });

  const regions = formData.country ? COUNTRIES_REGIONS[formData.country] || [] : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.surname || !formData.email || !formData.country || !formData.region) {
      toast.error(t.fillAll);
      return;
    }
    onSubmit(formData);
  };

  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50">
      <CardHeader className="space-y-1 pb-8">
        <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mb-4">
          <User className="text-white w-6 h-6" />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">{t.welcome}</CardTitle>
        <CardDescription className="text-neutral-500">{t.welcomeDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john.doe@example.com" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.target.value })} 
            />
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
    <Card className="border-none shadow-xl shadow-neutral-200/50 overflow-hidden">
      <div className="h-32 bg-neutral-900 relative">
        <div className="absolute -bottom-12 left-8 w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white overflow-hidden">
          <User className="w-12 h-12 text-neutral-900" />
        </div>
      </div>
      <CardHeader className="pt-16 pb-8">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold tracking-tight">{profile.name} {profile.surname}</CardTitle>
            <CardDescription className="text-neutral-500">{profile.email}</CardDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-neutral-200 bg-neutral-50 text-neutral-600">
            {profile.jobTitle === 'Teacher' ? t.jobs.teacher : 
             profile.jobTitle === 'Director' ? t.jobs.director :
             profile.jobTitle === 'Vice principal' ? t.jobs.vicePrincipal :
             profile.jobTitle === 'Deputy director' ? t.jobs.deputyDirector :
             profile.jobTitle === 'Student' ? t.jobs.student : profile.jobTitle}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.sex}</p>
            <p className="text-neutral-900 font-medium capitalize">
              {profile.sex === 'male' ? t.genders.male : 
               profile.sex === 'female' ? t.genders.female : t.genders.other}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.country}</p>
            <p className="text-neutral-900 font-medium">{profile.country}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.region}</p>
            <p className="text-neutral-900 font-medium">{profile.region}</p>
          </div>
        </div>
        <Separator className="bg-neutral-100" />
        <div className="flex flex-col items-center space-y-4">
          <p className="text-center text-neutral-500 max-w-md">
            {t.profileReady}
          </p>
          <Button onClick={onStart} size="lg" className="px-12 h-14 text-lg font-medium bg-neutral-900 hover:bg-neutral-800 transition-all rounded-full">
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
    const allSubjects = Array.from(new Set(grades.flatMap(g => g.subjects.map(s => s.name))));
    const totalClasses = grades.reduce((acc, curr) => acc + curr.numClasses, 0);
    
    if (allSubjects.length === 0) {
      toast.error(t.addSubject);
      return;
    }

    setIsSuggesting(true);
    try {
      toast.info(`${t.suggestTeachers}...`);
      const suggested = await suggestTeachers(allSubjects, totalClasses, lang);
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
    setTeachers([...teachers, { id: crypto.randomUUID(), name: '', preferredSubjects: [] }]);
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setTeachers(teachers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTeacher = (id: string) => {
    setTeachers(teachers.filter(t => t.id !== id));
  };

  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">{t.configTitle}</CardTitle>
        <CardDescription>{t.configDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full bg-neutral-100 p-1 rounded-xl">
            <TabsTrigger value="grades" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <School className="w-4 h-4 mr-2" /> {t.gradesAndSubjects}
            </TabsTrigger>
            <TabsTrigger value="lessons" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-2" /> {t.suggestedLessons}
            </TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
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
                  <Card key={g.grade} className="border-neutral-100 shadow-none bg-neutral-50/50">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center space-x-4">
                        <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-sm font-bold">
                          {g.grade}
                        </Badge>
                        <div className="space-y-1">
                          <CardTitle className="text-base">{t.grade} {g.grade}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs text-neutral-500">{t.classes}:</Label>
                            <Input 
                              type="number" 
                              className="h-7 w-16 text-xs" 
                              value={g.numClasses} 
                              onChange={e => updateGrade(g.grade, { numClasses: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeGrade(g.grade)} className="text-neutral-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.subject}</Label>
                        <Button variant="ghost" size="sm" onClick={() => addSubject(g.grade)} className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> {t.addSubject}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {g.subjects.map((s, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <Input 
                              placeholder={t.subject} 
                              className="h-8 text-sm flex-1" 
                              value={s.name} 
                              onChange={e => updateSubject(g.grade, idx, { name: e.target.value })}
                            />
                            <div className="flex items-center space-x-2 w-24">
                              <Input 
                                type="number" 
                                placeholder={t.hrs} 
                                className="h-8 text-sm" 
                                value={s.hoursPerWeek} 
                                onChange={e => updateSubject(g.grade, idx, { hoursPerWeek: parseInt(e.target.value) || 1 })}
                              />
                              <span className="text-[10px] text-neutral-400 font-medium">{t.hrsPerWeek}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeSubject(g.grade, idx)} className="h-8 w-8 text-neutral-400 hover:text-red-500">
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
              <h3 className="text-lg font-semibold">{t.suggestedLessons}</h3>
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
                className="rounded-full"
                disabled={isSuggesting}
              >
                {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t.suggestedLessons} (AI)
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {grades.map(g => (
                  <div key={g.grade} className="border rounded-xl p-4 bg-white shadow-sm">
                    <h4 className="font-bold text-sm mb-3 flex items-center">
                      <Badge variant="outline" className="mr-2">{g.grade}</Badge>
                      {t.gradesAndSubjects.split(' ')[0]} {g.grade}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {g.subjects.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-100">
                          <span className="text-xs font-medium truncate">{s.name}</span>
                          <span className="text-[10px] font-bold text-neutral-400 ml-2">{s.hoursPerWeek}h</span>
                        </div>
                      ))}
                      {g.subjects.length === 0 && (
                        <div className="col-span-full py-4 text-center text-xs text-neutral-400 italic">
                          No subjects assigned. Use the AI button or "Grades" tab.
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
                {teachers.map((t_item) => (
                  <Card key={t_item.id} className="border-neutral-100 shadow-none bg-neutral-50/50">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex-1 mr-4">
                        <Input 
                          placeholder={t.teacher} 
                          className="h-9 font-medium" 
                          value={t_item.name} 
                          onChange={e => updateTeacher(t_item.id, { name: e.target.value })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTeacher(t_item.id)} className="text-neutral-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.subject}</Label>
                        <Input 
                          placeholder={t.teacherPlaceholder} 
                          className="h-8 text-sm" 
                          value={t_item.preferredSubjects.join(', ')} 
                          onChange={e => updateTeacher(t_item.id, { preferredSubjects: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={onGenerate} 
            disabled={isLoading}
            size="lg" 
            className="px-8 h-12 bg-neutral-900 hover:bg-neutral-800 rounded-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t.generating}
              </>
            ) : (
              <>
                {t.generateSchedule} <Calendar className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
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
  t: any,
  lang: Language
}) {
  const [activeTab, setActiveTab] = useState('grid');
  const [editingSlot, setEditingSlot] = useState<{ day: string, slot: string, cls: string, grade: number, className: string } | null>(null);
  const [editData, setEditData] = useState({ subject: '', teacher: '' });

  // Map day names to translated versions
  const dayNameMap: Record<string, string> = {
    "Monday": t.days.monday,
    "Tuesday": t.days.tuesday,
    "Wednesday": t.days.wednesday,
    "Thursday": t.days.thursday,
    "Friday": t.days.friday,
    "Saturday": t.days.saturday,
    "Sunday": t.days.sunday,
  };

  // Helper to generate expected class labels for all configured grades
  const expectedClassNames = useMemo(() => {
    const names: string[] = [];
    [...allGrades].sort((a, b) => a.grade - b.grade).forEach(g => {
      for (let i = 0; i < g.numClasses; i++) {
        const label = String.fromCharCode(65 + i); // A, B, C...
        names.push(`${g.grade} ${label}`);
      }
    });
    return names;
  }, [allGrades]);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  const classNames = expectedClassNames.length > 0 ? expectedClassNames : Array.from(new Set(result.schedule.map(e => `${e.grade} ${e.className}`))).sort();

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

  // Get all unique time slots plus default ones
  const timeSlots = Array.from(new Set([
    ...DEFAULT_SLOTS,
    ...result.schedule.map(e => `${e.startTime}-${e.endTime}`)
  ])).sort();

  // Robust matching helper
  const isMatch = (e: any, day: string, slot: string, clsLabel: string) => {
    // Normalize time to HH:mm format
    const normalizeT = (tStr: string) => {
      const match = tStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return tStr;
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    };

    const eStart = normalizeT(e.startTime);
    const eEnd = normalizeT(e.endTime);
    const [sStart, sEnd] = slot.split('-').map(normalizeT);
    
    const timeMatch = eStart === sStart && eEnd === sEnd;
    
    // Normalize day
    const eDay = e.day.trim().toLowerCase();
    const targetDay = day.trim().toLowerCase();
    const dayMatch = eDay === targetDay || (eDay.length >= 3 && targetDay.startsWith(eDay)) || (targetDay.length >= 3 && eDay.startsWith(targetDay));

    // Normalize class matching
    const labelGrade = parseInt(clsLabel.split(' ')[0]);
    const labelClass = clsLabel.split(' ').pop();
    
    const labelMatch = `${e.grade} ${e.className}` === clsLabel || 
                      (e.grade === labelGrade && e.className === labelClass);

    return timeMatch && dayMatch && labelMatch;
  };

  const handleEditCell = (day: string, slot: string, clsLabel: string) => {
    const entry = result.schedule.find(e => isMatch(e, day, slot, clsLabel));
    
    const match = clsLabel.match(/(\d+) (.+)/);
    if (!match) return;
    const gradeNum = parseInt(match[1]);
    const classNameVal = match[2];

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
    const index = newSchedule.findIndex(e => isMatch(e, editingSlot.day, editingSlot.slot, editingSlot.cls));

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
        <div className="flex items-center space-x-2">
          <Badge variant={result.conflicts.length > 0 ? "destructive" : "default"} className="rounded-full">
            {result.conflicts.length} {t.conflicts}
          </Badge>
          <Button variant="outline" className="rounded-full" onClick={onRegenerate} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="mr-2 w-4 h-4" />}
            {t.regenerate}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => exportScheduleToExcel(result.schedule)}>
            <Download className="mr-2 w-4 h-4" /> {t.downloadExcel}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
            {t.printSchedule}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-lg shadow-neutral-200/50 overflow-hidden">
          <CardHeader className="bg-neutral-900 text-white">
            <CardTitle className="text-xl font-bold">{t.schoolScheduleGrid}</CardTitle>
            <CardDescription className="text-neutral-400">{t.editLessonDesc}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6 pt-4">
                <TabsList className="bg-neutral-100">
                  <TabsTrigger value="grid">{t.gridView}</TabsTrigger>
                  <TabsTrigger value="list">{t.listView}</TabsTrigger>
                  <TabsTrigger value="lessons">{t.suggestedLessons}</TabsTrigger>
                  <TabsTrigger value="conflicts">{t.conflicts}</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="grid" className="p-6">
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="border p-2 text-left bg-neutral-100 w-24">{t.kun}</th>
                        <th className="border p-2 text-center bg-neutral-100 w-12">#</th>
                        <th className="border p-2 text-center bg-neutral-100 w-32">{t.vaqt}</th>
                        {classNames.map(cls => (
                          <th key={cls} className="border p-2 text-center bg-yellow-400 font-bold min-w-[150px]">
                            {cls}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const daySlots = timeSlots;

                        return daySlots.map((slot, slotIdx) => {
                          const [start, end] = slot.split('-');
                          return (
                            <tr key={`${day}-${slot}`}>
                              {slotIdx === 0 && (
                                <td 
                                  className="border p-2 font-bold bg-neutral-50 text-center align-middle" 
                                  rowSpan={daySlots.length}
                                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                >
                                  {dayNameMap[day] || day}
                                </td>
                              )}
                              <td className="border p-2 text-center font-medium">{slotIdx + 1}</td>
                              <td className="border p-2 text-center text-xs">{start}-{end}</td>
                              {classNames.map(cls => {
                                const entry = result.schedule.find(e => isMatch(e, day, slot, cls));
                                return (
                                  <td 
                                    key={cls} 
                                    className="border p-2 text-center cursor-pointer hover:bg-neutral-50 transition-colors group relative"
                                    onClick={() => handleEditCell(day, slot, cls)}
                                  >
                                    {entry ? (
                                      <div className="space-y-1">
                                        <div className="font-bold">{entry.subject}</div>
                                        <div className="text-xs text-neutral-500">{entry.teacher}</div>
                                      </div>
                                    ) : (
                                      <div className="h-8 flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-neutral-200 group-hover:text-neutral-400" />
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
                          <TableCell className="font-medium">{entry.subject}</TableCell>
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
                                  <span className="text-xs font-medium text-neutral-700">{subject}</span>
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
                        <SelectItem key={s} value={s}>{s}</SelectItem>
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
