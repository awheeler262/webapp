/**
 * Create example blood pressure data.
 */
export class HeartExample {

    create(): string {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const thisMonthTime = thisMonth.getTime();

        const myDate = new Date(thisMonth);
        myDate.setFullYear(myDate.getFullYear() - 1);
        myDate.setMonth(myDate.getMonth() - 1);

        let currentMonth = myDate.getMonth() + 1;
        let monthIdx = 0;
        const data = [
            'date,time,systolic,diastolic,pulse,notes'
        ];

        while (myDate.getTime() < thisMonthTime) {
            const year = myDate.getFullYear();
            const month = myDate.getMonth() + 1;
            const day = myDate.getDate();

            if (currentMonth != month) {
                currentMonth = month;
                monthIdx += 1;
            }

            // night
            let hour = Math.floor(Math.random() * 5);
            let minute = Math.floor(Math.random() * 60);
            let row = this.getRow(year, month, day, hour, minute, monthIdx);
            data.push(row);

            // morning
            hour = Math.floor(Math.random() * 7) + 5;
            minute = Math.floor(Math.random() * 60);
            row = this.getRow(year, month, day, hour, minute, monthIdx);
            data.push(row);

            // afternoon
            hour = Math.floor(Math.random() * 6) + 12;
            minute = Math.floor(Math.random() * 60);
            row = this.getRow(year, month, day, hour, minute, monthIdx);
            data.push(row);

            // evening
            hour = Math.floor(Math.random() * 6) + 18;
            minute = Math.floor(Math.random() * 60);
            row = this.getRow(year, month, day, hour, minute, monthIdx);
            data.push(row);

            myDate.setDate(myDate.getDate() + 1);
        }

        return data.join('\n')
    }

    private getSystolic(month: number, hour: number): number {
        let bp = Math.floor(Math.random() * (5 + 1)) + 150;
        bp -= 3 * month;
        if (hour < 5 || hour >= 12) {
            bp -= 10;
        }
        return bp;
    }

    private getDiastolic(month: number, hour: number): number {
        let bp = Math.floor(Math.random() * (5 + 1)) + 100;
        bp -= 2 * month;
        if (hour < 5 || hour >= 12) {
            bp -= 5;
        }
        return bp;
    }

    private getPulse(month: number): number {
        let bp = Math.floor(Math.random() * (5 + 1)) + 65;
        bp -= 1 * month;
        return bp;
    }

    private getRow(
        year: number, month: number, day: number, hour: number, minute: number, monthIdx: number
    ): string {
        const systolic = this.getSystolic(monthIdx, hour);
        const diastolic = this.getDiastolic(monthIdx, hour);
        const pulse = this.getPulse(monthIdx);

        const row = [
            `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            systolic,
            diastolic,
            pulse,
            'example data'
        ].join(',');
        return row;
    }

}
