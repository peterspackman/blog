import { useEffect, useState } from 'react';

export interface Work {
    title: string;
    journal?: string;
    year?: string;
    url?: string;
}

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; works: Work[] };

const CACHE_KEY = (orcid: string) => `orcid-recent-${orcid}`;
const CACHE_MS = 24 * 60 * 60 * 1000;

/** Most recent journal articles from the public ORCID works summary (one request, cached for a day). */
export function useRecentWorks(orcid: string, count = 3): State {
    const [state, setState] = useState<State>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY(orcid)) ?? 'null');
            if (cached && Date.now() - cached.at < CACHE_MS) {
                setState({ status: 'ready', works: cached.works.slice(0, count) });
                return;
            }
        } catch {
            // No usable cache.
        }

        fetch(`https://pub.orcid.org/v3.0/${orcid}/works`, { headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((data) => {
                const works: (Work & { sortKey: string })[] = (data.group ?? [])
                    .map((group: any) => group['work-summary']?.[0])
                    .filter((w: any) => w && w.type === 'journal-article')
                    .map((w: any) => {
                        const date = w['publication-date'] ?? {};
                        const year = date.year?.value;
                        const doi = (w['external-ids']?.['external-id'] ?? []).find((id: any) => id['external-id-type'] === 'doi');
                        return {
                            title: w.title?.title?.value ?? 'Untitled',
                            journal: w['journal-title']?.value,
                            year,
                            url: doi ? `https://doi.org/${doi['external-id-value']}` : w.url?.value,
                            sortKey: `${year ?? '0000'}-${date.month?.value ?? '00'}-${date.day?.value ?? '00'}`,
                        };
                    })
                    .sort((a: any, b: any) => b.sortKey.localeCompare(a.sortKey));
                const top = works.slice(0, 10).map(({ sortKey, ...w }) => w);
                try {
                    localStorage.setItem(CACHE_KEY(orcid), JSON.stringify({ at: Date.now(), works: top }));
                } catch {
                    // Storage unavailable; fine.
                }
                if (!cancelled) setState({ status: 'ready', works: top.slice(0, count) });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error' });
            });
        return () => {
            cancelled = true;
        };
    }, [orcid, count]);

    return state;
}
