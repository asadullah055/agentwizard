import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  Settings as SettingsIcon, 
  Clock, 
  Calendar, 
  Users, 
  Edit3, 
  Trash2, 
  CheckCircle 
} from 'lucide-react';

interface Schedule {
  id: string;
  name: string;
  description: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  interval: number;
  active: boolean;
  dayType: 'weekday' | 'weekend';
}

const SchedulePage: React.FC = () => {
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      id: '1',
      name: 'Morning Rush',
      description: 'Early morning calling window',
      startHour: 8,
      startMinute: 15,
      endHour: 8,
      endMinute: 45,
      interval: 10,
      active: true,
      dayType: 'weekday'
    },
    {
      id: '2',
      name: 'Lunch Time Part 1',
      description: 'Lunch break calling (12:14-12:59)',
      startHour: 11,
      startMinute: 0,
      endHour: 12,
      endMinute: 59,
      interval: 10,
      active: true,
      dayType: 'weekday'
    },
    {
      id: '3',
      name: 'Lunch Time Part 2',
      description: 'Extended lunch break calling (13:00-13:59)',
      startHour: 16,
      startMinute: 0,
      endHour: 16,
      endMinute: 59,
      interval: 15,
      active: true,
      dayType: 'weekday'
    },
    {
      id: '4',
      name: 'After Work',
      description: 'Evening calling window after work hours (full hour)',
      startHour: 17,
      startMinute: 0,
      endHour: 17,
      endMinute: 59,
      interval: 15,
      active: true,
      dayType: 'weekday'
    },
    {
      id: '5',
      name: 'Weekend Morning',
      description: 'Weekend morning calling (not too early!)',
      startHour: 10,
      startMinute: 30,
      endHour: 10,
      endMinute: 59,
      interval: 10,
      active: true,
      dayType: 'weekend'
    },
    {
      id: '6',
      name: 'Weekend Afternoon',
      description: 'Weekend afternoon calling',
      startHour: 13,
      startMinute: 0,
      endHour: 14,
      endMinute: 59,
      interval: 10,
      active: true,
      dayType: 'weekend'
    },
    {
      id: '7',
      name: 'Weekend Evening',
      description: 'Weekend evening calling',
      startHour: 17,
      startMinute: 0,
      endHour: 18,
      endMinute: 59,
      interval: 10,
      active: true,
      dayType: 'weekend'
    }
  ]);

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule({ ...schedule });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSchedule(null);
  };

  const saveSchedule = () => {
    if (editingSchedule) {
      setSchedules(schedules.map(s => s.id === editingSchedule.id ? editingSchedule : s));
      closeEditModal();
    }
  };

  const toggleSchedule = (id: string) => {
    setSchedules(schedules.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  const deleteSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const weekdaySchedules = schedules.filter(s => s.dayType === 'weekday');
  const weekendSchedules = schedules.filter(s => s.dayType === 'weekend');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6" />
              System Status & Settings
            </h1>
            <p className="text-gray-600 mt-1">Current system configuration and controls</p>
          </div>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Calling System:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Active
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Timezone:</span>
                  <span className="text-sm font-medium">Europe/London</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Schedules:</span>
                  <span className="text-sm font-medium">7/7</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Batch Size:</span>
                  <span className="text-sm font-medium">5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Daily Limit:</span>
                  <span className="text-sm font-medium">1</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volume Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calls per batch
                  </label>
                  <input
                    type="number"
                    value={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily call limit
                  </label>
                  <input
                    type="number"
                    value={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Enable calling system</span>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={true}
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                    />
                    <label className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-600 cursor-pointer"></label>
                  </div>
                </div>
                <Button className="w-full bg-gray-900 text-white hover:bg-gray-800">
                  Update Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekday Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Weekday Schedules
              </CardTitle>
              <p className="text-sm text-gray-600">Monday - Friday calling windows (UK time)</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weekdaySchedules.map((schedule) => (
                  <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          schedule.active ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                    <p className="text-sm text-gray-900">
                      {formatTime(schedule.startHour, schedule.startMinute)} - {formatTime(schedule.endHour, schedule.endMinute)} every {schedule.interval} min
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekend Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Weekend Schedules
              </CardTitle>
              <p className="text-sm text-gray-600">Saturday - Sunday calling windows (UK time)</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weekendSchedules.map((schedule) => (
                  <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          schedule.active ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                    <p className="text-sm text-gray-900">
                      {formatTime(schedule.startHour, schedule.startMinute)} - {formatTime(schedule.endHour, schedule.endMinute)} every {schedule.interval} min
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Schedule Modal */}
        {isEditModalOpen && editingSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Schedule</h2>
              <p className="text-gray-600 mb-6">Configure when automated calls should be made</p>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Name
                    </label>
                    <input
                      type="text"
                      value={editingSchedule.name}
                      onChange={(e) => setEditingSchedule({...editingSchedule, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day Type
                    </label>
                    <select
                      value={editingSchedule.dayType}
                      onChange={(e) => setEditingSchedule({...editingSchedule, dayType: e.target.value as 'weekday' | 'weekend'})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="weekday">Weekdays (Mon-Fri)</option>
                      <option value="weekend">Weekends (Sat-Sun)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingSchedule.description}
                    onChange={(e) => setEditingSchedule({...editingSchedule, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Hour
                    </label>
                    <select
                      value={editingSchedule.startHour}
                      onChange={(e) => setEditingSchedule({...editingSchedule, startHour: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({length: 24}, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Minute
                    </label>
                    <select
                      value={editingSchedule.startMinute}
                      onChange={(e) => setEditingSchedule({...editingSchedule, startMinute: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[0, 15, 30, 45].map(min => (
                        <option key={min} value={min}>{min.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Hour
                    </label>
                    <select
                      value={editingSchedule.endHour}
                      onChange={(e) => setEditingSchedule({...editingSchedule, endHour: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({length: 24}, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Minute
                    </label>
                    <select
                      value={editingSchedule.endMinute}
                      onChange={(e) => setEditingSchedule({...editingSchedule, endMinute: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[0, 15, 30, 45, 59].map(min => (
                        <option key={min} value={min}>{min.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interval (minutes)
                  </label>
                  <input
                    type="number"
                    value={editingSchedule.interval}
                    onChange={(e) => setEditingSchedule({...editingSchedule, interval: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="60"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editingSchedule.active}
                    onChange={(e) => setEditingSchedule({...editingSchedule, active: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Active immediately
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <Button variant="outline" onClick={closeEditModal}>
                  Cancel
                </Button>
                <Button onClick={saveSchedule} className="bg-gray-900 text-white hover:bg-gray-800">
                  Update Schedule
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SchedulePage; 