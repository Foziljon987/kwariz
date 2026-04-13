import React, { useState } from 'react';
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
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { User, School, Users, Calendar, AlertCircle, CheckCircle2, Plus, Trash2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { generateSchedule } from './lib/gemini';

export default function App() {
  const [step, setStep] = useState<'register' | 'profile' | 'config' | 'result'>('register');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [grades, setGrades] = useState<GradeConfig[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = (data: UserProfile) => {
    setProfile(data);
    setStep('profile');
  };

  const handleStart = () => {
    setStep('config');
  };

  const handleGenerate = async () => {
    if (grades.length === 0 || teachers.length === 0) {
      toast.error("Please add at least one grade and one teacher.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await generateSchedule(grades, teachers);
      setScheduleResult(result);
      setStep('result');
      toast.success("Schedule generated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate schedule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <AnimatePresence mode="wait">
          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <RegistrationForm onSubmit={handleRegister} />
            </motion.div>
          )}

          {step === 'profile' && profile && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProfileView profile={profile} onStart={handleStart} />
            </motion.div>
          )}

          {step === 'config' && (
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

function RegistrationForm({ onSubmit }: { onSubmit: (data: UserProfile) => void }) {
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    surname: '',
    email: '',
    sex: 'other',
    country: '',
    region: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.surname || !formData.email) {
      toast.error("Please fill in all required fields.");
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
        <CardTitle className="text-3xl font-bold tracking-tight">Welcome</CardTitle>
        <CardDescription className="text-neutral-500">Please enter your personal information to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">First Name</Label>
              <Input 
                id="name" 
                placeholder="John" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Last Name</Label>
              <Input 
                id="surname" 
                placeholder="Doe" 
                value={formData.surname} 
                onChange={e => setFormData({ ...formData, surname: e.target.value })} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john.doe@example.com" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select value={formData.sex} onValueChange={v => setFormData({ ...formData, sex: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input 
                id="country" 
                placeholder="USA" 
                value={formData.country} 
                onChange={e => setFormData({ ...formData, country: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input 
                id="region" 
                placeholder="California" 
                value={formData.region} 
                onChange={e => setFormData({ ...formData, region: e.target.value })} 
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 text-lg font-medium bg-neutral-900 hover:bg-neutral-800 transition-all">
            Continue <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileView({ profile, onStart }: { profile: UserProfile, onStart: () => void }) {
  return (
    <Card className="border-none shadow-xl shadow-neutral-200/50 overflow-hidden">
      <div className="h-32 bg-neutral-900 relative">
        <div className="absolute -bottom-12 left-8 w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
          <User className="w-12 h-12 text-neutral-900" />
        </div>
      </div>
      <CardHeader className="pt-16 pb-8">
        <CardTitle className="text-3xl font-bold tracking-tight">{profile.name} {profile.surname}</CardTitle>
        <CardDescription className="text-neutral-500">{profile.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Sex</p>
            <p className="text-neutral-900 font-medium capitalize">{profile.sex}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Country</p>
            <p className="text-neutral-900 font-medium">{profile.country}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Region</p>
            <p className="text-neutral-900 font-medium">{profile.region}</p>
          </div>
        </div>
        <Separator className="bg-neutral-100" />
        <div className="flex flex-col items-center space-y-4">
          <p className="text-center text-neutral-500 max-w-md">
            Your profile is ready. You can now start configuring your school's grades, subjects, and teachers to generate an optimized schedule.
          </p>
          <Button onClick={onStart} size="lg" className="px-12 h-14 text-lg font-medium bg-neutral-900 hover:bg-neutral-800 transition-all rounded-full">
            Start Scheduling <ChevronRight className="ml-2 w-5 h-5" />
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
  isLoading
}: { 
  grades: GradeConfig[], 
  setGrades: React.Dispatch<React.SetStateAction<GradeConfig[]>>, 
  teachers: Teacher[], 
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>, 
  onGenerate: () => void,
  isLoading: boolean
}) {
  const [activeTab, setActiveTab] = useState('grades');

  const addGrade = () => {
    const nextGrade = grades.length > 0 ? Math.max(...grades.map(g => g.grade)) + 1 : 1;
    if (nextGrade > 11) {
      toast.error("Maximum 11 grades allowed.");
      return;
    }
    setGrades([...grades, { grade: nextGrade, numClasses: 1, subjects: [] }]);
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
        <CardTitle className="text-2xl font-bold tracking-tight">Schedule Configuration</CardTitle>
        <CardDescription>Configure your school structure and teaching staff.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full bg-neutral-100 p-1 rounded-xl">
            <TabsTrigger value="grades" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <School className="w-4 h-4 mr-2" /> Grades & Subjects
            </TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> Teachers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grades" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">School Grades</h3>
              <Button onClick={addGrade} variant="outline" size="sm" className="rounded-full">
                <Plus className="w-4 h-4 mr-1" /> Add Grade
              </Button>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {grades.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                    <p className="text-neutral-400">No grades added yet.</p>
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
                          <CardTitle className="text-base">Grade {g.grade}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs text-neutral-500">Classes:</Label>
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
                        <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Subjects</Label>
                        <Button variant="ghost" size="sm" onClick={() => addSubject(g.grade)} className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> Add Subject
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {g.subjects.map((s, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <Input 
                              placeholder="Subject Name" 
                              className="h-8 text-sm flex-1" 
                              value={s.name} 
                              onChange={e => updateSubject(g.grade, idx, { name: e.target.value })}
                            />
                            <div className="flex items-center space-x-2 w-24">
                              <Input 
                                type="number" 
                                placeholder="Hrs" 
                                className="h-8 text-sm" 
                                value={s.hoursPerWeek} 
                                onChange={e => updateSubject(g.grade, idx, { hoursPerWeek: parseInt(e.target.value) || 1 })}
                              />
                              <span className="text-[10px] text-neutral-400 font-medium">hrs/wk</span>
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

          <TabsContent value="teachers" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Teaching Staff</h3>
              <Button onClick={addTeacher} variant="outline" size="sm" className="rounded-full">
                <Plus className="w-4 h-4 mr-1" /> Add Teacher
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {teachers.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                    <p className="text-neutral-400">No teachers added yet.</p>
                  </div>
                )}
                {teachers.map((t) => (
                  <Card key={t.id} className="border-neutral-100 shadow-none bg-neutral-50/50">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex-1 mr-4">
                        <Input 
                          placeholder="Teacher Name" 
                          className="h-9 font-medium" 
                          value={t.name} 
                          onChange={e => updateTeacher(t.id, { name: e.target.value })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTeacher(t.id)} className="text-neutral-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Preferred Subjects</Label>
                        <Input 
                          placeholder="Math, Physics, History (comma separated)" 
                          className="h-8 text-sm" 
                          value={t.preferredSubjects.join(', ')} 
                          onChange={e => updateTeacher(t.id, { preferredSubjects: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
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
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                Generate Schedule <Calendar className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleResultView({ result, onBack }: { result: ScheduleResult, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('full');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-full">
          <ChevronLeft className="mr-2 w-4 h-4" /> Back to Config
        </Button>
        <div className="flex items-center space-x-2">
          <Badge variant={result.conflicts.length > 0 ? "destructive" : "default"} className="rounded-full">
            {result.conflicts.length} Conflicts
          </Badge>
          <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
            Print Schedule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg shadow-neutral-200/50 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-neutral-100 mb-4">
                <TabsTrigger value="full">Full View</TabsTrigger>
                <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="full">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Teacher</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.schedule.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{entry.day}</TableCell>
                          <TableCell className="text-xs text-neutral-500">{entry.startTime} - {entry.endTime}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">G{entry.grade} {entry.className}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{entry.subject}</TableCell>
                          <TableCell className="text-neutral-600">{entry.teacher}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="conflicts">
                <div className="space-y-4">
                  {result.conflicts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
                      <p>No conflicts detected!</p>
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

        <div className="space-y-6">
          <Card className="border-none shadow-lg shadow-neutral-200/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Teacher Stats</CardTitle>
              <CardDescription>Total hours per week</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {Object.entries(result.stats.teacherHours).map(([name, hours]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-700">{name}</span>
                      <Badge variant="secondary">{hours}h</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg shadow-neutral-200/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Grade Stats</CardTitle>
              <CardDescription>Total hours per week</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {Object.entries(result.stats.gradeHours).map(([grade, hours]) => (
                    <div key={grade} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-neutral-700">Grade {grade}</span>
                      <Badge variant="secondary">{hours}h</Badge>
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
