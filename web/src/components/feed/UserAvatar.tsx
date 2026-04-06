import type { UserBrief } from '@/types/feed';

type Props = {
	user: Pick<UserBrief, 'firstName' | 'lastName' | 'avatarUrl'>;
	size?: number;
	className?: string;
};

export function UserAvatar({ user, size = 32, className = '' }: Props) {
	const initials =
		`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
		'?';

	if (user.avatarUrl) {
		return (
			<img
				src={user.avatarUrl}
				alt=''
				className={`_liker_face _liker_face_img ${className}`.trim()}
				style={{ width: size, height: size }}
			/>
		);
	}

	return (
		<span
			className={`_liker_face _liker_face_placeholder d-inline-flex align-items-center justify-content-center ${className}`.trim()}
			style={{
				width: size,
				height: size,
				fontSize: Math.max(10, Math.round(size * 0.36)),
				background: '#e2e8f0',
				color: '#475569',
				fontWeight: 600,
				lineHeight: 1,
			}}
			aria-hidden
		>
			{initials}
		</span>
	);
}
