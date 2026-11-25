import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fcfa',
  standalone: true,
})
export class FcfaPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null || isNaN(value)) return '0 FCFA';
    const formatted = Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return `${formatted} FCFA`;
  }
}
