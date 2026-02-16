/**
 * Settings Page
 * Page des paramètres utilisateur et tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth, useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input } from '@/components/ui';
import { usersApi, ApiError } from '@/lib/api/users';
import toast, { Toaster } from 'react-hot-toast';

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const { logout, reloadUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'team'>('profile');

  const [isUpdating, setIsUpdating] = useState(false);

  // Profile form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Notifications form
  const [notificationsData, setNotificationsData] = useState({
    emailOnNewTicket: true,
    emailOnStatusChange: true,
    emailOnComment: false,
    emailWeeklyReport: true,
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await usersApi.updateProfile(profileData);
      await reloadUser();
      toast.success('Profil mis à jour avec succès !');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || 'Erreur lors de la mise à jour du profil');
      } else {
        toast.error('Erreur lors de la mise à jour du profil');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setIsUpdating(true);

    try {
      await usersApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Mot de passe mis à jour avec succès !');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401) {
          toast.error('Le mot de passe actuel est incorrect');
        } else {
          toast.error(error.message || 'Erreur lors de la mise à jour du mot de passe');
        }
      } else {
        toast.error('Erreur lors de la mise à jour du mot de passe');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotificationsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await usersApi.updateNotifications(notificationsData);
      toast.success('Préférences de notifications mises à jour !');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || 'Erreur lors de la mise à jour des notifications');
      } else {
        toast.error('Erreur lors de la mise à jour des notifications');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading || !user) {
    return <PageLoader />;
  }

  const tabs = [
    { id: 'profile', label: '👤 Profil', icon: '👤' },
    { id: 'security', label: '🔒 Sécurité', icon: '🔒' },
    { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
    { id: 'team', label: '👥 Équipe', icon: '👥' },
  ] as const;

  const settingsPages = [
    { href: '/dashboard/settings/plan', label: '💳 Plan & Usage' },
    { href: '/dashboard/settings/license', label: '🔑 License' },
    { href: '/dashboard/settings/ai', label: '🤖 AI Configuration' },
    { href: '/dashboard/settings/github', label: '🐙 GitHub' },
    { href: '/dashboard/settings/auth/sso', label: '🔐 SSO' },
    { href: '/dashboard/settings/status', label: '📊 Statut Systeme' },
  ];

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-600 mt-1">
            Gérez votre compte et vos préférences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card padding={false}>
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </Card>

            <Card padding={false} className="mt-4">
              <nav className="space-y-1">
                {settingsPages.map((page) => (
                  <a
                    key={page.href}
                    href={page.href}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {page.label}
                  </a>
                ))}
              </nav>
            </Card>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Informations du profil
                </h2>

                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <Input
                    label="Nom complet"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                    placeholder="John Doe"
                    disabled={isUpdating}
                  />

                  <Input
                    label="Email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) =>
                      setProfileData({ ...profileData, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    disabled={isUpdating}
                  />

                  <div className="pt-4 border-t">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Rôle</span>
                        <span className="font-medium text-gray-900 capitalize">
                          {user.role}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tenant ID</span>
                        <span className="font-mono text-xs text-gray-900">
                          {user.tenantId.substring(0, 20)}...
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">User ID</span>
                        <span className="font-mono text-xs text-gray-900">
                          {user.id.substring(0, 20)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" isLoading={isUpdating}>
                      Enregistrer les modifications
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setProfileData({
                          name: user.name || '',
                          email: user.email || '',
                        })
                      }
                      disabled={isUpdating}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Sécurité du compte
                </h2>

                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <Input
                    label="Mot de passe actuel"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    disabled={isUpdating}
                    required
                  />

                  <Input
                    label="Nouveau mot de passe"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    helperText="Au moins 8 caractères"
                    disabled={isUpdating}
                    required
                  />

                  <Input
                    label="Confirmer le nouveau mot de passe"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    disabled={isUpdating}
                    required
                  />

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" isLoading={isUpdating}>
                      Changer le mot de passe
                    </Button>
                  </div>
                </form>

                <div className="mt-8 pt-8 border-t">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Sessions actives
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          💻 Session actuelle
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Windows • Chrome • {new Date().toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span className="text-xs text-green-600 font-medium">
                        ● Actif
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => logout()}
                    className="mt-4"
                  >
                    Se déconnecter de toutes les sessions
                  </Button>
                </div>
              </Card>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Préférences de notifications
                </h2>

                <form onSubmit={handleNotificationsUpdate} className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={notificationsData.emailOnNewTicket}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          emailOnNewTicket: e.target.checked,
                        })
                      }
                      disabled={isUpdating}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        Nouveau ticket
                      </div>
                      <div className="text-xs text-gray-500">
                        Recevoir un email quand un nouveau ticket est créé
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={notificationsData.emailOnStatusChange}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          emailOnStatusChange: e.target.checked,
                        })
                      }
                      disabled={isUpdating}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        Changement de statut
                      </div>
                      <div className="text-xs text-gray-500">
                        Recevoir un email quand le statut d&apos;un ticket change
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={notificationsData.emailOnComment}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          emailOnComment: e.target.checked,
                        })
                      }
                      disabled={isUpdating}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        Nouveaux commentaires
                      </div>
                      <div className="text-xs text-gray-500">
                        Recevoir un email pour les commentaires sur vos tickets
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={notificationsData.emailWeeklyReport}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          emailWeeklyReport: e.target.checked,
                        })
                      }
                      disabled={isUpdating}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        Rapport hebdomadaire
                      </div>
                      <div className="text-xs text-gray-500">
                        Recevoir un résumé hebdomadaire de l&apos;activité
                      </div>
                    </div>
                  </label>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" isLoading={isUpdating}>
                      Enregistrer les préférences
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <Card>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Gestion de l&apos;équipe
                </h2>

                <div className="mb-6">
                  <Button>
                    ➕ Inviter un membre
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                        {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.name || user.email}
                        </p>
                        <p className="text-xs text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full capitalize">
                      {user.role}
                    </span>
                  </div>

                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Aucun autre membre pour l&apos;instant</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
