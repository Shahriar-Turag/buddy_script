'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiJson, ApiError, setApiCsrfToken } from '@/lib/api';
import type { CommentNode, Post, UserBrief } from '@/types/feed';
import { FeedLayoutMode } from '@/components/feed/FeedLayoutMode';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { FeedMobileChrome } from '@/components/feed/FeedMobileChrome';
import { FeedLeftSidebar } from '@/components/feed/FeedLeftSidebar';
import { FeedRightSidebar } from '@/components/feed/FeedRightSidebar';
import { FeedStoriesBand } from '@/components/feed/FeedStoriesBand';
import { FeedComposer } from '@/components/feed/FeedComposer';
import { PostCard } from '@/components/feed/PostCard';

type MeResponse = { user: UserBrief; csrfToken: string };

/**
 * Feed list stays O(posts) document reads; comments load in one bounded batch per page.
 */
async function fetchPostsWithComments(search: string): Promise<{
	posts: Post[];
	nextCursor: string | null;
}> {
	const data = await apiJson<{ posts: Post[]; nextCursor: string | null }>(
		`/api/posts${search}`,
	);
	const ids = data.posts.filter((p) => p.commentCount > 0).map((p) => p.id);
	let threads: Record<string, CommentNode[]> = {};
	if (ids.length > 0) {
		const batch = await apiJson<{ threads: Record<string, CommentNode[]> }>(
			'/api/posts/batch/comment-threads',
			{ method: 'POST', body: JSON.stringify({ postIds: ids }) },
		);
		threads = batch.threads;
	}
	const posts = data.posts.map((p) => ({
		...p,
		comments: threads[p.id] ?? [],
	}));
	return { posts, nextCursor: data.nextCursor };
}

export function FeedPageClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const scrolledForPost = useRef<string | null>(null);
	const [me, setMe] = useState<UserBrief | null>(null);
	const [posts, setPosts] = useState<Post[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadMoreBusy, setLoadMoreBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
	const [refreshBanner, setRefreshBanner] = useState<string | null>(null);

	const loadInitial = useCallback(async () => {
		setError(null);
		setLoadMoreError(null);
		try {
			const { posts: nextPosts, nextCursor: nc } =
				await fetchPostsWithComments('?limit=20');
			setPosts(nextPosts);
			setNextCursor(nc);
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				router.push('/login');
				router.refresh();
				return;
			}
			setError(e instanceof ApiError ? e.message : 'Failed to load feed');
		} finally {
			setLoading(false);
		}
	}, [router]);

	useEffect(() => {
		(async () => {
			try {
				const meRes = await apiJson<MeResponse>('/api/auth/me');
				setApiCsrfToken(meRes.csrfToken);
				setMe(meRes.user);
			} catch {
				router.push('/login');
				router.refresh();
				return;
			}
			await loadInitial();
		})();
	}, [router, loadInitial]);

	const refreshPostsSilently = useCallback(async () => {
		try {
			const meRes = await apiJson<MeResponse>('/api/auth/me');
			setApiCsrfToken(meRes.csrfToken);
			const { posts: nextPosts, nextCursor: nc } =
				await fetchPostsWithComments('?limit=20');
			setPosts(nextPosts);
			setNextCursor(nc);
			setRefreshBanner(null);
		} catch {
			setRefreshBanner('Could not refresh the feed. Try again.');
		}
	}, []);

	const refreshSinglePost = useCallback(async (postId: string) => {
		setRefreshBanner(null);
		try {
			const data = await apiJson<{ post: Post }>(
				`/api/posts/${postId}/hydrate`,
			);
			setPosts((prev) =>
				prev.map((p) => (p.id === postId ? data.post : p)),
			);
		} catch (e) {
			if (e instanceof ApiError && e.status === 403) {
				try {
					const meRes = await apiJson<MeResponse>('/api/auth/me');
					setApiCsrfToken(meRes.csrfToken);
				} catch {
					/* ignore */
				}
			}
			setRefreshBanner(
				'Could not refresh this post. Reload the page if it looks out of date.',
			);
		}
	}, []);

	useEffect(() => {
		const postId = searchParams.get('post');
		if (!postId) {
			scrolledForPost.current = null;
			return;
		}
		if (loading || posts.length === 0) return;
		if (scrolledForPost.current === postId) return;
		const el = document.getElementById(`post-${postId}`);
		if (!el) return;
		scrolledForPost.current = postId;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		router.replace('/feed', { scroll: false });
	}, [searchParams, loading, posts, router]);

	async function loadMore() {
		if (!nextCursor || loadMoreBusy) return;
		setLoadMoreBusy(true);
		setLoadMoreError(null);
		try {
			const { posts: more, nextCursor: nc } =
				await fetchPostsWithComments(
					`?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
				);
			setPosts((p) => [...p, ...more]);
			setNextCursor(nc);
		} catch (e) {
			setLoadMoreError(
				e instanceof ApiError ? e.message : 'Could not load more posts',
			);
		} finally {
			setLoadMoreBusy(false);
		}
	}

	function removePost(id: string) {
		setPosts((prev) => prev.filter((p) => p.id !== id));
	}

	if (!me) {
		return (
			<div className='_layout _layout_main_wrapper p-5 text-center'>
				<p className='_social_login_content_para'>Loading…</p>
			</div>
		);
	}

	return (
		<div className='_layout _layout_main_wrapper'>
			<FeedLayoutMode />
			<div className='_main_layout'>
				<FeedHeader
					me={me}
					onMeUpdated={(u) => {
						setMe(u);
						void refreshPostsSilently();
					}}
				/>
				<FeedMobileChrome />
				<div className='container _custom_container'>
					<div className='_layout_inner_wrap'>
						<div className='row'>
							<div className='col-xl-3 col-lg-3 col-md-12 col-sm-12'>
								<FeedLeftSidebar />
							</div>
							<div className='col-xl-6 col-lg-6 col-md-12 col-sm-12'>
								<div className='_layout_middle_wrap'>
									<div className='_layout_middle_inner'>
										{error ? (
											<p
												className='_social_login_content_para _mar_b16'
												style={{ color: '#c53030' }}
											>
												{error}
											</p>
										) : null}
										{refreshBanner ? (
											<p
												className='_social_login_content_para _mar_b16'
												style={{ color: '#b7791f' }}
											>
												{refreshBanner}
											</p>
										) : null}
										{loadMoreError ? (
											<p
												className='_social_login_content_para _mar_b16'
												style={{ color: '#c53030' }}
											>
												{loadMoreError}
											</p>
										) : null}
										<FeedStoriesBand />
										<FeedComposer
											avatarSrc='/assets/images/txt_img.png'
											onCreated={(post) =>
												setPosts((p) => [post, ...p])
											}
										/>
										{loading ? (
											<p className='_social_login_content_para text-center _mar_b16'>
												Loading feed…
											</p>
										) : null}
										{posts.map((post) => (
											<PostCard
												key={post.id}
												post={post}
												me={me}
												onPostRefresh={
													refreshSinglePost
												}
												onDelete={removePost}
											/>
										))}
										{nextCursor ? (
											<div className='text-center _mar_b24'>
												<button
													type='button'
													className='_social_login_form_btn_link _btn1'
													onClick={loadMore}
													disabled={loadMoreBusy}
												>
													{loadMoreBusy
														? 'Loading…'
														: 'Load more'}
												</button>
											</div>
										) : null}
									</div>
								</div>
							</div>
							<div className='col-xl-3 col-lg-3 col-md-12 col-sm-12'>
								<FeedRightSidebar />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
