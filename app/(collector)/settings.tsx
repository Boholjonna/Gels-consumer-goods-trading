import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  sort_order: number;
}

type SettingsTab = 'profile' | 'credits';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'credits') {
      loadTeam();
      loadGroupPhoto();
    }
  }, [activeTab]);

  async function loadTeam() {
    setTeamLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('sort_order');
    setTeamMembers((data as TeamMember[]) || []);
    setTeamLoading(false);
  }

  async function loadGroupPhoto() {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl('team/group-photo.jpg');
    try {
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if (res.ok) setGroupPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch {
      // no group photo yet
    }
  }

  async function handleLogout() {
    setShowLogoutModal(false);
    await signOut();
  }

  const researchers = teamMembers.filter((m) => m.role === 'Researcher');
  const developers = teamMembers.filter((m) => m.role === 'Developer');

  return (
    <View className="flex-1 bg-[#0D1F33]">
      {/* Tab Switcher */}
      <View className="px-4 pt-3 pb-2 bg-[#162F4D] border-b border-[#1E3F5E]/30">
        <View className="flex-row bg-[#0D1F33] rounded-lg p-1 max-w-xs self-center">
          {([
            { key: 'profile' as const, label: 'Profile', icon: 'person-outline' as const },
            { key: 'credits' as const, label: 'Credits', icon: 'heart-outline' as const },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className={`flex-1 flex-row items-center justify-center py-2 rounded-md gap-1.5 ${
                activeTab === tab.key ? 'bg-[#5B9BD5]' : ''
              }`}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? '#fff' : '#8FAABE99'}
              />
              <Text
                className={`text-xs font-medium ${
                  activeTab === tab.key ? 'text-white' : 'text-[#8FAABE]/60'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View className="items-center">
          <View
            style={isTablet ? { maxWidth: 600, width: '100%' } : { width: '100%' }}
            className="px-4 py-6"
          >
            {activeTab === 'profile' && (
              <>
                {/* Profile Section */}
                <View className="bg-[#162F4D] rounded-xl p-5 mb-6 border border-[#1E3F5E]/60">
                  <View className="items-center mb-4">
                    <View className="w-16 h-16 rounded-full bg-[#5B9BD5]/10 items-center justify-center mb-3">
                      <Ionicons name="person" size={32} color="#5B9BD5" />
                    </View>
                    <Text className="text-xl font-bold text-[#E8EDF2]">
                      {user?.full_name}
                    </Text>
                    <Text className="text-sm text-[#8FAABE]/60 mt-1">{user?.email}</Text>
                    <View className="bg-[#5B9BD5]/10 px-3 py-1 rounded-full mt-2">
                      <Text className="text-[#5B9BD5] text-xs font-medium capitalize">
                        {user?.role}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* App Info */}
                <View className="bg-[#162F4D] rounded-xl p-5 mb-6 border border-[#1E3F5E]/60">
                  <Text className="text-xs font-semibold text-[#8FAABE]/50 uppercase mb-3">
                    App Info
                  </Text>
                  <View className="flex-row justify-between py-3 border-b border-[#1E3F5E]/30">
                    <Text className="text-sm text-[#8FAABE]">Version</Text>
                    <Text className="text-sm text-[#E8EDF2] font-medium">1.0.0</Text>
                  </View>
                  <View className="flex-row justify-between py-3">
                    <Text className="text-sm text-[#8FAABE]">Account Status</Text>
                    <Text className="text-sm text-[#98C379] font-medium">Active</Text>
                  </View>
                </View>

                {/* Account */}
                <View className="bg-[#162F4D] rounded-xl p-5 border border-[#1E3F5E]/60">
                  <Text className="text-xs font-semibold text-[#8FAABE]/50 uppercase mb-3">
                    Account
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center py-3"
                    onPress={() => setShowLogoutModal(true)}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#E06C75" />
                    <Text className="text-[#E06C75] font-medium ml-3">Log Out</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {activeTab === 'credits' && (
              <>
                {/* Group Photo */}
                {groupPhotoUrl && (
                  <View className="bg-[#162F4D] rounded-xl overflow-hidden mb-6 border border-[#1E3F5E]/60">
                    <Image
                      source={{ uri: groupPhotoUrl }}
                      className="w-full h-48"
                      resizeMode="cover"
                    />
                  </View>
                )}

                {teamLoading ? (
                  <View className="items-center py-12">
                    <ActivityIndicator size="large" color="#5B9BD5" />
                  </View>
                ) : (
                  <>
                    {/* Researchers */}
                    <View className="mb-6">
                      <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="school-outline" size={16} color="#5B9BD5" />
                        <Text className="text-xs font-bold text-[#8FAABE]/50 uppercase tracking-wider">
                          Researchers ({researchers.length})
                        </Text>
                      </View>
                      {researchers.length === 0 ? (
                        <View className="bg-[#162F4D] rounded-xl p-6 border border-[#1E3F5E]/60 items-center">
                          <Text className="text-sm text-[#8FAABE]/40">No researchers added yet</Text>
                        </View>
                      ) : (
                        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                          {researchers.map((member) => (
                            <View
                              key={member.id}
                              className="bg-[#162F4D] rounded-xl p-4 items-center border border-[#1E3F5E]/60"
                              style={{ width: (width - 44) / 2 }}
                            >
                              {member.avatar_url ? (
                                <Image
                                  source={{ uri: member.avatar_url }}
                                  className="w-16 h-16 rounded-full mb-3"
                                  style={{ borderWidth: 2, borderColor: '#1E3F5E99' }}
                                />
                              ) : (
                                <View className="w-16 h-16 rounded-full bg-[#0D1F33] items-center justify-center mb-3 border-2 border-[#1E3F5E]/60">
                                  <Ionicons name="person" size={28} color="#8FAABE33" />
                                </View>
                              )}
                              <Text className="text-sm font-semibold text-[#E8EDF2] text-center" numberOfLines={1}>
                                {member.name}
                              </Text>
                              <Text className="text-[10px] text-[#8FAABE]/50 mt-0.5">
                                {member.role}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Developers */}
                    <View className="mb-6">
                      <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="code-slash-outline" size={16} color="#C678DD" />
                        <Text className="text-xs font-bold text-[#8FAABE]/50 uppercase tracking-wider">
                          Developers ({developers.length})
                        </Text>
                      </View>
                      {developers.length === 0 ? (
                        <View className="bg-[#162F4D] rounded-xl p-6 border border-[#1E3F5E]/60 items-center">
                          <Text className="text-sm text-[#8FAABE]/40">No developers added yet</Text>
                        </View>
                      ) : (
                        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                          {developers.map((member) => (
                            <View
                              key={member.id}
                              className="bg-[#162F4D] rounded-xl p-4 items-center border border-[#1E3F5E]/60"
                              style={{ width: (width - 44) / 2 }}
                            >
                              {member.avatar_url ? (
                                <Image
                                  source={{ uri: member.avatar_url }}
                                  className="w-16 h-16 rounded-full mb-3"
                                  style={{ borderWidth: 2, borderColor: '#1E3F5E99' }}
                                />
                              ) : (
                                <View className="w-16 h-16 rounded-full bg-[#0D1F33] items-center justify-center mb-3 border-2 border-[#1E3F5E]/60">
                                  <Ionicons name="person" size={28} color="#8FAABE33" />
                                </View>
                              )}
                              <Text className="text-sm font-semibold text-[#E8EDF2] text-center" numberOfLines={1}>
                                {member.name}
                              </Text>
                              <Text className="text-[10px] text-[#8FAABE]/50 mt-0.5">
                                {member.role}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#162F4D] rounded-2xl p-6 w-full max-w-sm border border-[#1E3F5E]/60">
            <View className="items-center mb-4">
              <View className="w-14 h-14 rounded-full bg-[#E06C75]/10 items-center justify-center mb-3">
                <Ionicons name="warning" size={28} color="#E06C75" />
              </View>
              <Text className="text-lg font-bold text-[#E8EDF2] text-center">
                Are you sure?
              </Text>
            </View>
            <Text className="text-[#8FAABE] text-center mb-6 leading-5">
              You will need the Admin's QR code or activation code to log back
              in. Make sure you have access before logging out.
            </Text>
            <TouchableOpacity
              className="bg-[#E06C75] rounded-lg py-3.5 items-center mb-3"
              onPress={handleLogout}
            >
              <Text className="text-white font-semibold">Yes, Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-[#1A3755] rounded-lg py-3.5 items-center"
              onPress={() => setShowLogoutModal(false)}
            >
              <Text className="text-[#8FAABE] font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
