import test from 'node:test';
import assert from 'node:assert/strict';

import { activitySchema } from '../schemas.ts';
import { activitySelectorSchema } from '../admin-command.ts';

test('activity schema accepts canonical fields and multiple schedules', () => {
    const parsed = activitySchema.safeParse({
        title_he: 'כדורסל', description_he: '', category_id: '', target_age_group: 'kids',
        min_age: '6', max_age: '8', days_of_week: '', start_time: '', end_time: '',
        start_date: '', end_date: '', price: '120', instructor_name: '', location: 'מרכז',
        venue: 'אולם א', group_name: 'קבוצה 1', contact_name: '', contact_phone: '', contact_email: '',
        notes: '', min_grade: '1', max_grade: '3', max_participants: '20', current_participants: '',
        is_active: true,
        schedules: [
            { day_of_week: 2, start_time: '17:00', end_time: '18:00' },
            { day_of_week: 4, start_time: '18:00', end_time: '19:00' },
        ],
    });
    assert.equal(parsed.success, true);
});

test('activity schema rejects reversed ages and schedules', () => {
    const parsed = activitySchema.safeParse({
        title_he: 'כדורסל', description_he: null, category_id: null, target_age_group: null,
        min_age: 10, max_age: 6, days_of_week: null, start_time: null, end_time: null,
        start_date: null, end_date: null, price: null, instructor_name: null, location: null,
        max_participants: null, current_participants: 0, is_active: true,
        schedules: [{ day_of_week: 2, start_time: '18:00', end_time: '17:00' }],
    });
    assert.equal(parsed.success, false);
});

test('admin selector supports a precise composite target', () => {
    const selector = activitySelectorSchema.parse({ name: 'כדורסל', branch: 'מרכז', day: 'רביעי', start_time: '17:00', age: 7 });
    assert.equal(selector.name, 'כדורסל');
    assert.equal(selector.age, 7);
    assert.equal(selector.activity_id, null);
});

