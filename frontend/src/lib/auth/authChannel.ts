import { activityBus } from './activityBus';

class AuthChannel {
  private channel: BroadcastChannel | null = null;

  init() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !this.channel) {
      this.channel = new BroadcastChannel('auth-channel');
      
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'activity') {
          activityBus.syncActivity(event.data.timestamp);
        } else if (event.data?.type === 'logout') {
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
      };
    }
  }

  broadcastActivity(timestamp: number) {
    if (this.channel) {
      this.channel.postMessage({ type: 'activity', timestamp });
    }
  }

  broadcastLogout() {
    if (this.channel) {
      this.channel.postMessage({ type: 'logout' });
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

export const authChannel = new AuthChannel();
