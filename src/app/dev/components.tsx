import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme/tokens';

// Dev-only gallery of every shared component ("kitchen sink").
// Handy for checking a style change everywhere at once.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="accent">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export default function ComponentsScreen() {
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [text, setText] = useState('');
  const [chip, setChip] = useState<'All' | 'Runs' | 'Walks'>('All');
  const [count, setCount] = useState(3);
  const ping = () => Alert.alert('Pressed');

  return (
    <Screen>
      <Section title="Text">
        <AppText variant="display" numeric>
          5:42
        </AppText>
        <AppText variant="headline">Headline</AppText>
        <AppText variant="title">Title</AppText>
        <AppText>Body text for paragraphs and list items.</AppText>
        <AppText variant="caption" tone="muted">
          Caption, muted
        </AppText>
        <AppText variant="label" tone="muted">
          Label
        </AppText>
        <View style={styles.row}>
          <AppText tone="accent">Accent</AppText>
          <AppText tone="warning">Warning</AppText>
          <AppText tone="danger">Danger</AppText>
        </View>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={ping} />
        <Button label="Secondary" variant="secondary" onPress={ping} />
        <Button label="Danger" variant="danger" onPress={ping} />
        <Button label="Ghost" variant="ghost" onPress={ping} />
        <Button label="Disabled" onPress={ping} disabled />
      </Section>

      <Section title="Stat tiles">
        <StatTile label="Elapsed" value="32:15" size="large" />
        <View style={styles.row}>
          <StatTile label="Distance" value="5.21 km" />
          <StatTile label="Pace" value="6:11 /km" />
        </View>
      </Section>

      <Section title="Cards and rows">
        <Card>
          <AppText variant="title">Card</AppText>
          <AppText tone="muted">Static container for grouped content.</AppText>
        </Card>
        <Card onPress={ping} accessibilityLabel="Tappable card">
          <AppText variant="title">Tappable card</AppText>
        </Card>
        <Card>
          <ListRow icon="person-outline" title="Plain row" subtitle="With a subtitle" />
          <ListRow icon="speedometer-outline" title="Row with value" value="km" onPress={ping} />
        </Card>
      </Section>

      <Section title="Inputs">
        <SegmentedControl
          options={[
            { value: 'km', label: 'Kilometres' },
            { value: 'mi', label: 'Miles' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        <TextField label="Text field" value={text} onChangeText={setText} placeholder="Type…" />
        <TextField label="With suffix and hint" suffix="kg" hint="A helpful hint" />
        <TextField label="With error" error="Something is wrong with this value" />
        <TextField label="Multi-line" multiline placeholder="Notes…" />
        <View style={styles.row}>
          {(['All', 'Runs', 'Walks'] as const).map((label) => (
            <Chip
              key={label}
              label={label}
              selected={chip === label}
              onPress={() => setChip(label)}
            />
          ))}
        </View>
        <Stepper
          accessibilityLabel="Example stepper"
          value={count}
          min={1}
          max={7}
          onChange={setCount}
          format={(value) => `${value} per week`}
        />
      </Section>

      <Section title="Icons">
        <View style={styles.row}>
          <Icon name="walk" />
          <Icon name="bicycle" />
          <Icon name="barbell" />
          <Icon name="trail-sign" />
          <Icon name="flame" color={colors.accent} />
        </View>
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState
            icon="time-outline"
            title="Nothing here yet"
            message="Explains what will show up here and how to get started."
            actionLabel="Do the thing"
            onAction={ping}
          />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
});
