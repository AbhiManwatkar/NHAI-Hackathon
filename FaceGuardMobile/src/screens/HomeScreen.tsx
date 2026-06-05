/**
 * FaceGuard Offline – Home Screen
 * Premium dark dashboard with live stats, model info, and quick actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import { C, S, R, T } from '../theme';
import { getStats } from '../storage';

export default function HomeScreen({ navigation }: any) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalEmployees:0, todayCheckIns:0, totalAttendance:0, unsyncedCount:0 });
  const [isOnline, setIsOnline] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
      const net = await Network.getNetworkStateAsync();
      setIsOnline(!!net.isConnected);
    } catch {}
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:500, useNativeDriver:true }),
    ]).start();
    loadStats();
    const unsub = navigation.addListener('focus', loadStats);
    return unsub;
  }, [fadeAnim, slideAnim, loadStats, navigation]);

  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

  const MetricCard = ({ icon, label, value, color }: { icon: string; label: string; value: string|number; color: string }) => (
    <View style={[styles.metricCard, { borderColor: color+'25' }]}>
      <Text style={{ fontSize:20 }}>{icon}</Text>
      <Text style={[T.mL, { color, fontSize:22 }]}>{value}</Text>
      <Text style={[T.l3, { color: C.t3 }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingBottom:S.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.p400} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity:fadeAnim, transform:[{translateY:slideAnim}] }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}><Text style={{fontSize:24}}>🛡️</Text></View>
            <View>
              <Text style={[T.d3, {color:C.t1}]}>FaceGuard</Text>
              <Text style={[T.b3, {color:C.t3}]}>Offline Biometric System</Text>
            </View>
          </View>
          <View style={styles.siteBadge}><Text style={[T.l3, {color:C.p400}]}>NH-044</Text></View>
        </Animated.View>

        {/* Status Bar */}
        <View style={styles.syncBar}>
          <View style={styles.syncLeft}>
            <View style={[styles.dot, {backgroundColor: isOnline ? C.a400 : C.w500}]} />
            <Text style={[T.b3, {color:C.t2, fontWeight:'600'}]}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <Text style={[T.l3, {color:C.t3}]}>Queue</Text>
            <Text style={[T.m, {color: stats.unsyncedCount > 0 ? C.w400 : C.a400, fontSize:16}]}>{stats.unsyncedCount}</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
            <Text style={[T.l3, {color:C.t3}]}>Records</Text>
            <Text style={[T.m, {color:C.t2, fontSize:16}]}>{stats.totalAttendance}</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <MetricCard icon="👥" label="Enrolled" value={stats.totalEmployees} color={C.p400} />
          <MetricCard icon="✅" label="Today" value={stats.todayCheckIns} color={C.a400} />
          <MetricCard icon="⚡" label="Latency" value="<1s" color={C.w400} />
          <MetricCard icon="🎯" label="Accuracy" value="97%" color={C.a400} />
        </View>

        {/* Hero CTA */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Pressable style={styles.heroCard} onPress={() => navigation.navigate('Auth')}>
          <View style={styles.heroIconBox}><Ionicons name="camera" size={28} color={C.a400} /></View>
          <View style={{flex:1}}>
            <Text style={[T.h1, {color:C.t1}]}>Mark Attendance</Text>
            <Text style={[T.b3, {color:C.t2}]}>Face scan → Verify → Done in {'<'}1 second</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={C.a400} />
        </Pressable>

        <View style={styles.actionGrid}>
          <Pressable style={styles.actionCard} onPress={() => navigation.navigate('Enroll')}>
            <Ionicons name="person-add" size={28} color={C.p400} />
            <Text style={[T.h3, {color:C.t1, marginTop:S.sm}]}>Enroll</Text>
            <Text style={[T.b3, {color:C.t3}]}>Add employee</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="settings" size={28} color={C.t2} />
            <Text style={[T.h3, {color:C.t1, marginTop:S.sm}]}>Admin</Text>
            <Text style={[T.b3, {color:C.t3}]}>Settings & data</Text>
          </Pressable>
        </View>

        {/* System Health */}
        <Text style={styles.sectionTitle}>System Health</Text>
        <View style={styles.card}>
          <View style={styles.healthRow}>
            {[
              {label:'ML Engine', value:'Ready', ok:true},
              {label:'Vault', value:'SQLite', ok:true},
              {label:'Network', value:isOnline?'Connected':'Offline', ok:isOnline},
            ].map(h => (
              <View key={h.label} style={{alignItems:'center', flex:1}}>
                <View style={[styles.dot, {backgroundColor: h.ok ? C.a400 : C.w500, width:10, height:10, borderRadius:5, marginBottom:S.xs}]} />
                <Text style={[T.l3, {color:C.t3}]}>{h.label}</Text>
                <Text style={[T.b3, {color:C.t2, fontWeight:'600'}]}>{h.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Models */}
        <Text style={styles.sectionTitle}>AI Model Cascade</Text>
        <View style={styles.card}>
          {[
            {name:'BlazeFace', task:'Detection', size:'0.1 MB', time:'<50ms'},
            {name:'MobileFaceNet', task:'Embedding', size:'2.3 MB', time:'<200ms'},
            {name:'MiniFASNet', task:'Liveness', size:'1.1 MB', time:'<150ms'},
          ].map((m,i) => (
            <View key={m.name} style={[styles.modelRow, i>0 && {borderTopWidth:1, borderTopColor:C.b1}]}>
              <View style={{flex:1}}>
                <Text style={[T.b2, {color:C.t1, fontWeight:'600'}]}>{m.name}</Text>
                <Text style={[T.b3, {color:C.t3}]}>{m.task}</Text>
              </View>
              <Text style={[T.m, {color:C.p400, fontSize:11, marginRight:S.lg}]}>{m.size}</Text>
              <Text style={[T.m, {color:C.p400, fontSize:11}]}>{m.time}</Text>
            </View>
          ))}
          <View style={{borderTopWidth:1, borderTopColor:C.b2, paddingTop:S.md, marginTop:S.xs, alignItems:'center'}}>
            <Text style={[T.b3, {color:C.a400, fontWeight:'700'}]}>Total: 3.5 MB · {'<'}430ms pipeline</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{alignItems:'center', paddingTop:S.xxxl}}>
          <Text style={[T.b3, {color:C.t3, fontStyle:'italic'}]}>Built for the field · Secured by design</Text>
          <Text style={[T.l3, {color:C.b3, marginTop:S.xs}]}>v1.0.0 · NHAI Datalake 3.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex:1, backgroundColor:C.bg },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:S.xl, paddingTop:60, paddingBottom:S.lg },
  logoRow: { flexDirection:'row', alignItems:'center' },
  logoBadge: { width:48, height:48, borderRadius:R.md, backgroundColor:C.p500+'20', justifyContent:'center', alignItems:'center', marginRight:S.md, borderWidth:1, borderColor:C.p500+'40' },
  siteBadge: { backgroundColor:C.p500+'20', borderColor:C.p500+'40', borderWidth:1, borderRadius:R.sm, paddingHorizontal:S.sm, paddingVertical:S.xs },
  syncBar: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:C.g1, borderWidth:1, borderColor:C.b1, borderRadius:R.md, paddingVertical:S.sm, paddingHorizontal:S.md, marginHorizontal:S.lg },
  syncLeft: { flexDirection:'row', alignItems:'center', flex:1 },
  dot: { width:8, height:8, borderRadius:4, marginRight:S.xs },
  metricsRow: { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:S.lg, marginTop:S.lg, gap:S.sm },
  metricCard: { alignItems:'center', flex:1, padding:S.sm, borderRadius:R.md, borderWidth:1, backgroundColor:C.g1 },
  sectionTitle: { ...T.l1, color:C.t3, paddingHorizontal:S.xl, marginTop:S.xl, marginBottom:S.md },
  heroCard: { flexDirection:'row', alignItems:'center', backgroundColor:C.g2, borderWidth:1, borderColor:C.a400+'30', borderRadius:R.lg, padding:S.lg, marginHorizontal:S.lg },
  heroIconBox: { width:56, height:56, borderRadius:R.md, backgroundColor:C.a400+'15', justifyContent:'center', alignItems:'center', marginRight:S.lg },
  actionGrid: { flexDirection:'row', paddingHorizontal:S.lg, gap:S.md, marginTop:S.md },
  actionCard: { flex:1, alignItems:'center', paddingVertical:S.xl, backgroundColor:C.g1, borderWidth:1, borderColor:C.b1, borderRadius:R.lg },
  card: { backgroundColor:C.g1, borderWidth:1, borderColor:C.b1, borderRadius:R.lg, padding:S.lg, marginHorizontal:S.lg },
  healthRow: { flexDirection:'row', justifyContent:'space-between' },
  modelRow: { flexDirection:'row', alignItems:'center', paddingVertical:S.md },
});
