'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface DurationInputProps {
    label: string;
    description?: string;
    totalSeconds: number;
    minTotalSeconds?: number;
    maxTotalSeconds?: number;
    onChange: (sec: number) => void;
}

export function DurationInput({ label, description, totalSeconds, minTotalSeconds = 0, maxTotalSeconds, onChange }: DurationInputProps) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const isMinError = totalSeconds < minTotalSeconds;
    const isMaxError = maxTotalSeconds !== undefined && totalSeconds > maxTotalSeconds;
    const isError = isMinError || isMaxError;

    const formatMin = (sec: number) => {
        if (sec >= 3600) return `${sec / 3600} hours`;
        if (sec >= 60) return `${sec / 60} minutes`;
        return `${sec} seconds`;
    };

    const update = (h: number, m: number, s: number) => {
        const validH = Math.max(0, h || 0);
        const validM = Math.max(0, m || 0);
        const validS = Math.max(0, s || 0);
        onChange(validH * 3600 + validM * 60 + validS);
    };

    return (
        <div className="space-y-3 w-full max-w-[320px]">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex-1 flex flex-col gap-1">
                    <Input 
                        type="number" 
                        min={0} 
                        value={hours || ''} 
                        placeholder="0"
                        className={cn("text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", isError && "border-red-500 text-red-500 focus-visible:ring-red-500")}
                        onChange={(e) => update(parseInt(e.target.value), minutes, seconds)} 
                    />
                    <span className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wider">Hrs</span>
                </div>
                <span className="font-bold pb-4 text-muted-foreground">:</span>
                <div className="flex-1 flex flex-col gap-1">
                    <Input 
                        type="number" 
                        min={0} 
                        max={59} 
                        value={minutes || ''} 
                        placeholder="0"
                        className={cn("text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", isError && "border-red-500 text-red-500 focus-visible:ring-red-500")}
                        onChange={(e) => update(hours, parseInt(e.target.value), seconds)} 
                    />
                    <span className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wider">Min</span>
                </div>
                <span className="font-bold pb-4 text-muted-foreground">:</span>
                <div className="flex-1 flex flex-col gap-1">
                    <Input 
                        type="number" 
                        min={0} 
                        max={59} 
                        value={seconds || ''} 
                        placeholder="0"
                        className={cn("text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", isError && "border-red-500 text-red-500 focus-visible:ring-red-500")}
                        onChange={(e) => update(hours, minutes, parseInt(e.target.value))} 
                    />
                    <span className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wider">Sec</span>
                </div>
            </div>
            {isMinError && <p className="text-[11px] font-medium text-red-500 mt-1">Minimum required: {formatMin(minTotalSeconds)}</p>}
            {isMaxError && <p className="text-[11px] font-medium text-red-500 mt-1">Maximum allowed: {formatMin(maxTotalSeconds!)}</p>}
            {description && !isError && <p className="text-xs text-muted-foreground leading-relaxed pt-1">{description}</p>}
        </div>
    );
}
