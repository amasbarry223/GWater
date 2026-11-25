import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Toast } from './models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  show(type: Toast['type'], message: string, duration = 4000) {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, message, duration };
    this.toastsSubject.next([...this.toastsSubject.value, toast]);
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration - 300);
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(msg: string, dur = 4000) { this.show('success', msg, dur); }
  error(msg: string, dur = 5000)   { this.show('error', msg, dur);   }
  warning(msg: string, dur = 4500) { this.show('warning', msg, dur); }
  info(msg: string, dur = 4000)    { this.show('info', msg, dur);    }

  remove(id: string) {
    this.toastsSubject.next(
      this.toastsSubject.value.map(t => t.id === id ? { ...t, leaving: true } : t)
    );
  }

  dismiss(id: string) {
    this.toastsSubject.next(this.toastsSubject.value.filter(t => t.id !== id));
  }
}
