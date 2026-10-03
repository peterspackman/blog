import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { VizPage } from './layout';
import styles from './CardIndex.module.css';

export interface IndexCard {
    title: string;
    href: string;
    description: string;
    /** Optional small illustration shown at the top of the card. */
    preview?: React.ReactNode;
}

export interface IndexSection {
    title?: string;
    cards: IndexCard[];
}

export interface CardIndexProps {
    title: string;
    description: string;
    intro: React.ReactNode;
    sections: IndexSection[];
    footer?: React.ReactNode;
}

/** Landing page listing tools or visualisations as a grid of link cards. */
export function CardIndex({ title, description, intro, sections, footer }: CardIndexProps) {
    return (
        <VizPage title={title} description={description} intro={intro}>
            {sections.map((section, i) => (
                <section key={section.title ?? i} className={styles.section}>
                    {section.title && <h2 className={styles.sectionTitle}>{section.title}</h2>}
                    <div className={styles.grid}>
                        {section.cards.map((card) => (
                            <Link key={card.href} to={card.href} className={clsx(styles.card, card.preview && styles.withPreview)}>
                                {card.preview && <div className={styles.preview} aria-hidden="true">{card.preview}</div>}
                                <h3 className={styles.cardTitle}>{card.title}</h3>
                                <p className={styles.cardDesc}>{card.description}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
            {footer && <div className={styles.footer}>{footer}</div>}
        </VizPage>
    );
}
