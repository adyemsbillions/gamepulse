import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CLUB_SUGGESTIONS, COUNTRIES } from '@/constants/places';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { MAX_AVATAR_BYTES, USERNAME_PATTERN, UserFacingError } from '@/lib/data/source';
import { useUpdateProfile, useUploadAvatar, useUsernameAvailable } from '@/lib/queries';
import type { LocalImage, User } from '@/lib/types';

/** Square crop from the gallery. Null if cancelled; throws a UserFacingError if it's unusable. */
async function pickPhoto(): Promise<LocalImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const size = asset.fileSize ?? asset.file?.size;
  if (size && size > MAX_AVATAR_BYTES) throw new UserFacingError('That photo is too big (5 MB max).');
  return { uri: asset.uri, mimeType: asset.mimeType ?? asset.file?.type ?? 'image/jpeg', file: asset.file };
}

/** Placeholder usernames given at sign-up; the user must replace them. */
const isPlaceholder = (username: string) => /^fan_[0-9a-f]{12}$/.test(username);

type Props = {
  user: User;
  submitLabel: string;
  /** Called after a successful save with the updated profile. */
  onSaved: (user: User) => void;
};

/** Username, name, country, club and bio. Used for first-time setup and for editing. */
export function ProfileForm({ user, submitLabel, onSaved }: Props) {
  const [username, setUsername] = useState(isPlaceholder(user.username) ? '' : user.username);
  const [displayName, setDisplayName] = useState(user.displayName === user.username ? '' : user.displayName);
  const [country, setCountry] = useState(user.country);
  const [club, setClub] = useState(user.favoriteClub);
  const [bio, setBio] = useState(user.bio);
  const [error, setError] = useState<string | null>(null);
  const save = useUpdateProfile();
  const photo = useUploadAvatar();

  const changePhoto = async () => {
    setError(null);
    try {
      const image = await pickPhoto();
      if (!image) return;
      await photo.mutateAsync(image);
    } catch (e) {
      setError(e instanceof UserFacingError ? e.message : "Couldn't update your photo. Check your connection and try again.");
    }
  };

  // Check availability once typing pauses.
  const [checked, setChecked] = useState(username);
  useEffect(() => {
    const t = setTimeout(() => setChecked(username), 400);
    return () => clearTimeout(t);
  }, [username]);
  const validFormat = USERNAME_PATTERN.test(username);
  const changed = username !== user.username;
  const availability = useUsernameAvailable(checked, validFormat && changed && checked === username);
  const taken = changed && availability.data === false;

  const usernameHint = !username
    ? 'Pick the name fans will find you by.'
    : !validFormat
      ? '3–24 characters: lowercase letters, numbers, _ and .'
      : !changed
        ? 'This is your username.'
        : availability.isFetching || checked !== username
          ? 'Checking…'
          : taken
            ? 'Taken. Try another.'
            : 'Available.';

  const canSave =
    validFormat && !taken && displayName.trim().length > 0 && country.length > 0 && club.trim().length > 0;

  const submit = () => {
    setError(null);
    const flag = COUNTRIES.find((c) => c.name === country)?.flag ?? user.countryFlag;
    save.mutate(
      {
        username,
        displayName: displayName.trim(),
        country,
        countryFlag: flag,
        favoriteClub: club.trim(),
        bio: bio.trim(),
        onboarded: true,
      },
      {
        onSuccess: onSaved,
        onError: (e) =>
          setError(e instanceof UserFacingError ? e.message : "Couldn't save. Check your connection and try again."),
      },
    );
  };

  const clubMatches = CLUB_SUGGESTIONS.filter(
    (c) => c !== club && (!club || c.toLowerCase().includes(club.toLowerCase())),
  ).slice(0, 8);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          disabled={photo.isPending}
          onPress={changePhoto}>
          <Avatar
            user={{
              ...user,
              displayName: displayName || user.displayName,
              avatarUrl: photo.data?.avatarUrl ?? user.avatarUrl,
            }}
            size={72}
          />
          <View style={styles.cameraBadge}>
            {photo.isPending ? (
              <ActivityIndicator size="small" color={Colors.iceWhite} />
            ) : (
              <Camera size={14} color={Colors.iceWhite} />
            )}
          </View>
        </Pressable>
        <View style={styles.avatarNote}>
          <Pressable accessibilityRole="button" disabled={photo.isPending} onPress={changePhoto} hitSlop={8}>
            <AppText variant="bodyBold" color={Colors.primary}>
              {photo.isPending ? 'Uploading photo…' : 'Change photo'}
            </AppText>
          </Pressable>
          <AppText variant="caption" color={Colors.textSecondary}>
            A clear, square photo works best.
          </AppText>
        </View>
      </View>

      <Field label="Username" hint={usernameHint} hintTone={taken || (!!username && !validFormat) ? 'bad' : validFormat && changed && availability.data ? 'good' : 'plain'}>
        <View style={styles.inputRow}>
          <AppText variant="bodyBold" color={Colors.textSecondary}>
            @
          </AppText>
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
            placeholder="yourname"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            style={[styles.input, styles.flex]}
          />
          {validFormat && changed && checked === username && !availability.isFetching && (
            availability.data ? <Check size={18} color={Colors.primary} /> : taken ? <X size={18} color={Colors.danger} /> : null
          )}
          {availability.isFetching && <ActivityIndicator size="small" color={Colors.primary} />}
        </View>
      </Field>

      <Field label="Name">
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How your name shows on Moments"
          placeholderTextColor={Colors.textSecondary}
          maxLength={50}
          style={[styles.input, styles.box]}
        />
      </Field>

      <Field label="Country">
        <View style={styles.chips}>
          {COUNTRIES.map((c) => {
            const on = c.name === country;
            return (
              <Pressable
                key={c.name}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setCountry(c.name)}
                style={[styles.chip, on && styles.chipOn]}>
                <AppText variant="label" color={on ? Colors.iceWhite : Colors.text}>
                  {c.flag} {c.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Favourite club">
        <TextInput
          value={club}
          onChangeText={setClub}
          placeholder="Type your club"
          placeholderTextColor={Colors.textSecondary}
          maxLength={40}
          style={[styles.input, styles.box]}
        />
        {clubMatches.length > 0 && (
          <View style={[styles.chips, styles.suggestions]}>
            {clubMatches.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Choose ${c}`} onPress={() => setClub(c)} style={styles.chip}>
                <AppText variant="label">{c}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </Field>

      <Field label="Bio (optional)">
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Left foot only. Enyimba till I die."
          placeholderTextColor={Colors.textSecondary}
          maxLength={160}
          multiline
          style={[styles.input, styles.box, styles.bio]}
        />
      </Field>

      {error && (
        <AppText variant="caption" color={Colors.danger} style={styles.error}>
          {error}
        </AppText>
      )}
      <Button
        label={save.isPending ? 'Saving…' : submitLabel}
        onPress={submit}
        disabled={!canSave || save.isPending}
      />
    </ScrollView>
  );
}

function Field({
  label,
  hint,
  hintTone = 'plain',
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: 'plain' | 'good' | 'bad';
  children: React.ReactNode;
}) {
  const hintColor = hintTone === 'bad' ? Colors.danger : hintTone === 'good' ? Colors.primary : Colors.textSecondary;
  return (
    <View style={styles.field}>
      <AppText variant="bodyBold">{label}</AppText>
      {children}
      {hint && (
        <AppText variant="caption" color={hintColor}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatarNote: { flex: 1, gap: 2 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: Spacing.two },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text, paddingVertical: 0 },
  box: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bio: { height: 88, paddingTop: Spacing.three, textAlignVertical: 'top' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  suggestions: { marginTop: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  error: { textAlign: 'center' },
});
