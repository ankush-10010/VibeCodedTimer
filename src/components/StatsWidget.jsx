import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export default function StatsWidget({ onClose, user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const statsRef = collection(db, 'users', user.uid, 'stats');
        const q = query(statsRef, orderBy('date', 'desc'), limit(7));
        const querySnapshot = await getDocs(q);
        
        const fetchedData = [];
        querySnapshot.forEach((doc) => {
          fetchedData.push(doc.data());
        });

        // Reverse so chronological order left to right
        fetchedData.reverse();

        // If no data, provide dummy data for visualization
        if (fetchedData.length === 0) {
          const dummy = [];
          for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dummy.push({
              date: d.toLocaleDateString('en-US', { weekday: 'short' }),
              focusTimeMinutes: 0
            });
          }
          setData(dummy);
        } else {
          // Format data for Recharts
          const formatted = fetchedData.map(d => ({
            date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            focusTimeMinutes: Math.round(d.totalMs / 60000)
          }));
          setData(formatted);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  return (
    <div className="absolute bottom-20 right-0 w-[400px] glass-panel rounded-2xl p-6 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col h-[300px] mb-4 origin-bottom-right">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h2 text-lg text-primary">Focus Stats</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined">close</span></button>
      </div>
      
      {!user ? (
        <div className="flex-grow flex items-center justify-center text-on-surface-variant text-sm">
          Please login to view your focus statistics.
        </div>
      ) : loading ? (
        <div className="flex-grow flex items-center justify-center text-primary">
          Loading...
        </div>
      ) : (
        <div className="flex-grow w-full h-full text-sm">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="date" stroke="#e5e2e1" opacity={0.6} tick={{fill: '#e5e2e1'}} axisLine={false} tickLine={false} />
              <YAxis stroke="#e5e2e1" opacity={0.6} tick={{fill: '#e5e2e1'}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.1)'}} contentStyle={{backgroundColor: '#141313', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff'}} />
              <Bar dataKey="focusTimeMinutes" fill="#ddb7ff" radius={[4, 4, 0, 0]} name="Minutes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
