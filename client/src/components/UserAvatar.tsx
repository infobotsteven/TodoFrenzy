import type { Avatar, User } from '@todo/shared';
import { t } from '../i18n';
import { avatarLabel, AVATAR_SPRITES, spriteRects } from './avatars';

/** Rozmiary podajemy w px przy 100% - w CSS jako rem, żeby awatary skalowały się razem z resztą interfejsu. */
const px = (size: number) => `${size / 16}rem`;

/** Awatar w kółku: pikselowy zwierzak (SVG) na pastelowym tle. `size` w pikselach. */
export function AvatarImage({ avatar, size = 28, title }: { avatar: Avatar; size?: number; title?: string }) {
  return (
    <span
      className="avatar"
      style={{ width: px(size), height: px(size), background: AVATAR_SPRITES[avatar].palette.bg }}
      role="img"
      aria-label={title ?? avatarLabel(avatar)}
      title={title}
    >
      <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
        {spriteRects(avatar).map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
        ))}
      </svg>
    </span>
  );
}

/** Użytkownik: awatar z podpowiedzią z nickiem. */
function UserAvatar({ user, size = 24 }: { user: User; size?: number }) {
  return <AvatarImage avatar={user.avatar} size={size} title={user.nick} />;
}

/** Kilku użytkowników obok siebie (lekko nachodzące awatary); nadmiar skrócony do „+N". */
export function UserStack({ users, size = 24, max = 4 }: { users: User[]; size?: number; max?: number }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="user-stack" aria-label={t('users.assignedLabel', { nicks: users.map((u) => u.nick).join(', ') })}>
      {shown.map((u) => (
        <UserAvatar key={u.id} user={u} size={size} />
      ))}
      {rest > 0 && (
        <span className="avatar avatar-more" style={{ width: px(size), height: px(size) }} title={users.slice(max).map((u) => u.nick).join(', ')}>
          +{rest}
        </span>
      )}
    </span>
  );
}

