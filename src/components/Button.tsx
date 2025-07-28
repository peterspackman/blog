import React, { ReactNode, CSSProperties } from 'react';
import clsx from 'clsx'; 
import Link from '@docusaurus/Link';

// Define the Button type to control the props that can be passed to the Button component.
type Button = {
    // The size prop can be one of the following values: 'sm', 'lg', 'small', 'medium', 'large', or null.
    size?: 'sm' | 'lg' | 'small' | 'medium' | 'large' | null;
    // The outline prop is a boolean that determines if the button should be an outline button.
    outline?: boolean;
    // The variant prop is a string that determines the color of the button.
    variant: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'info' | 'link' | string;
    // The block prop is a boolean that determines if the button should be a block-level button.
    block?: boolean;
    // The disabled prop is a boolean that determines if the button should be disabled.
    disabled?: boolean;
    // The className prop is a string that allows you to add custom classes to the button.
    className?: string;
    // The style prop is an object that allows you to add custom styles to the button.
    style?: CSSProperties;
    // The link prop is a string that determines the URL the button should link to.
    link?: string;
    // The label prop is a string that determines the text of the button.
    label?: string;
    // The onClick prop is a function that will be called when the button is clicked.
    onClick?: () => void;
    // The children prop allows passing content as children instead of using the label prop
    children?: ReactNode;
}

// Button component that accepts the specified props.
export default function Button ({ 
    size = null, 
    outline = false, 
    variant = 'primary', 
    block = false, 
    disabled = false, 
    className, 
    style, 
    link, 
    label,
    onClick,
    children
}: Button) {
    // Map the size prop values to corresponding CSS classes.
    const sizeMap = {
        sm: 'sm',
        small: 'sm',
        lg: 'lg',
        large: 'lg',
        medium: null,
    };
    const buttonSize = size ? sizeMap[size] : '';
    const sizeClass = buttonSize ? `button--${buttonSize}` : '';
    const outlineClass = outline ? 'button--outline' : '';
    const variantClass = variant ? `button--${variant}` : '';
    const blockClass = block ? 'button--block' : '';
    const disabledClass = disabled ? 'disabled' : '';
    
    // Use label or children for button content
    const buttonContent = children || label;
    
    // Handle the button's click event
    const handleClick = (e) => {
        if (disabled) {
            e.preventDefault();
            return;
        }
        
        if (onClick) {
            onClick();
        }
    };
    
    // If there's a link, render as Link with a button inside
    if (link) {
        return (
            <Link to={disabled ? null : link}>
                <button
                    className={clsx(
                        'button',
                        sizeClass,
                        outlineClass,
                        variantClass,
                        blockClass,
                        disabledClass,
                        className
                    )}
                    style={style}
                    role='button'
                    aria-disabled={disabled}
                    onClick={handleClick}
                >
                    {buttonContent}
                </button>
            </Link>
        );
    }
    
    // If there's no link, just render the button
    return (
        <button
            className={clsx(
                'button',
                sizeClass,
                outlineClass,
                variantClass,
                blockClass,
                disabledClass,
                className
            )}
            style={style}
            disabled={disabled}
            onClick={handleClick}
        >
            {buttonContent}
        </button>
    );
}
