'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Users, Clock, AlertCircle } from 'lucide-react'

const attendanceData = [
    { date: 'Mon', present: 145, absent: 8, late: 12 },
    { date: 'Tue', present: 152, absent: 5, late: 8 },
    { date: 'Wed', present: 148, absent: 9, late: 11 },
    { date: 'Thu', present: 156, absent: 3, late: 6 },
    { date: 'Fri', present: 158, absent: 2, late: 5 },
]



const recentActivities = [
    { id: 1, employee: 'John Doe', action: 'Checked In', time: '08:15 AM', status: 'on-time' },
    { id: 2, employee: 'Jane Smith', action: 'Checked Out', time: '05:45 PM', status: 'on-time' },
    { id: 3, employee: 'Mike Johnson', action: 'Checked In', time: '08:42 AM', status: 'late' },
    { id: 4, employee: 'Sarah Williams', action: 'Checked Out', time: '05:30 PM', status: 'on-time' },
    { id: 5, employee: 'Robert Brown', action: 'Absent', time: 'N/A', status: 'absent' },
]

export default function Dashboard() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check if user is authenticated by verifying token in localStorage
        const token = typeof window !== 'undefined' && localStorage.getItem('token')
        const employee = typeof window !== 'undefined' && localStorage.getItem('employee')

        if (!token || !employee) {
            router.replace('/login')  // Use replace to prevent back button navigation
        } else {
            setIsLoading(false)
        }
    }, [router])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-full animate-spin mb-4">
                        <div className="w-8 h-8 bg-background rounded-full"></div>
                    </div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Welcome to BITS Admin Panel</p>
                </div>
                <Button className="bg-primary hover:bg-primary/90">Generate Report</Button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Total Employees</p>
                            <p className="text-3xl font-bold text-foreground mt-2">1,240</p>
                            <p className="text-xs text-muted-foreground mt-2">+2.5% from last month</p>
                        </div>
                        <div className="bg-primary/20 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-card border-border p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Present Today</p>
                            <p className="text-3xl font-bold text-foreground mt-2">1,156</p>
                            <p className="text-xs text-muted-foreground mt-2">93.2% attendance rate</p>
                        </div>
                        <div className="bg-primary/20 p-3 rounded-lg">
                            <Clock className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </Card>



                <Card className="bg-card border-border p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">System Status</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                <p className="text-foreground font-bold">Operational</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">99.9% uptime</p>
                        </div>
                        <div className="bg-primary/20 p-3 rounded-lg">
                            <AlertCircle className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6">
                <Card className="bg-card border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Attendance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={attendanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                            <YAxis stroke="rgba(255,255,255,0.6)" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(22, 28, 45, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px'
                                }}
                                labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                            />
                            <Legend />
                            <Bar dataKey="present" fill="var(--color-chart-1)" />
                            <Bar dataKey="absent" fill="var(--color-chart-2)" />
                            <Bar dataKey="late" fill="var(--color-chart-3)" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>


            </div>

            {/* Recent Activities */}
            <Card className="bg-card border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activities</h3>
                <div className="space-y-3">
                    {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
                            <div className="flex-1">
                                <p className="text-foreground font-medium">{activity.employee}</p>
                                <p className="text-sm text-muted-foreground">{activity.action}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-foreground text-sm font-medium">{activity.time}</p>
                                <Badge
                                    variant="outline"
                                    className={activity.status === 'on-time' ? 'bg-green-500/20 text-green-300 border-green-500/30' : activity.status === 'late' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}
                                >
                                    {activity.status === 'on-time' ? 'On Time' : activity.status === 'late' ? 'Late' : 'Absent'}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    )
}
