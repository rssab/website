package;

import js.html.Request;
import js.html.Response;
import js.html.URL;
import haxe.extern.EitherType;
import haxe.Template;
import js.node.Fs;

using StringTools;

class Server {
    // Cached templates (loaded at startup)
    static final templates = new Map<String, Template>();
    static final rawTemplates = new Map<String, String>();
    
    public static function main():Void {
        final port = 8080;
        
        loadTemplates();
        
        Bun.serve({
            port: port,
            fetch: handleRequest,
        });
        
        trace('🚀 Server running at http://localhost:$port');
    }
    
    static function loadTemplates():Void {
        // Load partials (keep raw for layout assembly)
        loadTemplate('layout', 'templates/partials/layout.html');
        loadTemplate('navigation', 'templates/partials/navigation.html');
        loadTemplate('footer', 'templates/partials/footer.html');
        loadTemplate('404', 'templates/partials/404.html');
        loadTemplate('subscribe-success', 'templates/partials/subscribe-success.html');
        
        // Load pages
        loadTemplate('home', 'templates/pages/home.html');
        loadTemplate('mission', 'templates/pages/mission.html');
        loadTemplate('about', 'templates/pages/about.html');
        loadTemplate('equipment', 'templates/pages/equipment.html');
        loadTemplate('technology', 'templates/pages/technology.html');
        loadTemplate('kits', 'templates/pages/kits.html');
        loadTemplate('community', 'templates/pages/community.html');
        loadTemplate('finances', 'templates/pages/finances.html');
        loadTemplate('contact', 'templates/pages/contact.html');
        
        trace('📄 Loaded ${Lambda.count(templates)} templates');
    }
    
    static function loadTemplate(name:String, path:String):Void {
        final content = Fs.readFileSync(path, {encoding: 'utf8',});
        rawTemplates.set(name, content);
        templates.set(name, new Template(content));
    }
    
    static function handleRequest(req:Request):EitherType<Response, js.lib.Promise<Response>> {
        final url = new URL(req.url);
        final path = url.pathname;
        final isHtmx = req.headers.get('HX-Request') == 'true';
        
        return if (path.startsWith('/static/')) {
            serveStaticFile(path);
        } else {
            switch path {
                case '/', '/home': renderPage('Home', 'home', {}, isHtmx);
                case '/mission': renderPage('Mission', 'mission', {}, isHtmx);
                case '/about': renderPage('About', 'about', {}, isHtmx);
                case '/equipment': renderPage('Equipment', 'equipment', {}, isHtmx);
                case '/technology': renderPage('Technology', 'technology', {}, isHtmx);
                case '/kits': renderPage('Kits', 'kits', {}, isHtmx);
                case '/community': renderPage('Community', 'community', {}, isHtmx);
                case '/finances': renderPage('Finances', 'finances', {}, isHtmx);
                case '/contact': renderPage('Contact', 'contact', {}, isHtmx);
                case '/subscribe': handleSubscribe(req);
                default: notFound(isHtmx);
            }
        };
    }
    
    static function renderPage(title:String, templateName:String, data:Dynamic, isHtmx:Bool):Response {
        final template = templates.get(templateName);
        
        return if (template == null) {
            notFound(isHtmx);
        } else {
            final content = template.execute(data);
            final html = if (isHtmx) content else fullPage(title, content);
            new Response(html, {
                headers: createHeaders('text/html; charset=utf-8'),
            });
        };
    }
    
    static function fullPage(title:String, content:String):String {
        final layout = rawTemplates.get('layout');
        
        return if (layout == null) {
            content;
        } else {
            final nav = rawTemplates.get('navigation');
            final footer = rawTemplates.get('footer');
            
            // Use string replacement for layout assembly (raw HTML injection)
            layout
                .replace('::title::', title)
                .replace('::navigation::', nav != null ? nav : '')
                .replace('::content::', content)
                .replace('::footer::', footer != null ? footer : '');
        };
    }
    
    static function createHeaders(contentType:String):Dynamic {
        return js.lib.Object.fromEntries([
            ['Content-Type', contentType],
            ['Cache-Control', 'no-cache']
        ]);
    }
    
    static function handleSubscribe(req:Request):Response {
        final template = templates.get('subscribe-success');
        final html = if (template == null) 'Success!' else template.execute({});
        return new Response(html, {
            headers: createHeaders('text/html; charset=utf-8'),
        });
    }
    
    static function serveStaticFile(path:String):Response {
        final filePath = '.' + path; // Remove leading slash, add current directory
        
        try {
            final content = Fs.readFileSync(filePath, {encoding: 'utf8'});
            final contentType = if (path.endsWith('.js')) {
                'application/javascript; charset=utf-8';
            } else if (path.endsWith('.css')) {
                'text/css; charset=utf-8';
            } else {
                'text/plain; charset=utf-8';
            }
            
            return new Response(content, {
                headers: createHeaders(contentType),
            });
        } catch (e:Dynamic) {
            return new Response('File not found', {
                status: 404,
                headers: createHeaders('text/plain; charset=utf-8'),
            });
        }
    }
    
    static function notFound(isHtmx:Bool):Response {
        final template = templates.get('404');
        final html = if (template == null) {
            '404 - Not Found';
        } else {
            final content = template.execute({});
            if (isHtmx) content else fullPage('Not Found', content);
        };
        
        return new Response(html, {
            status: 404,
            headers: createHeaders('text/html; charset=utf-8'),
        });
    }
}

// Bun externs
@:native('Bun')
extern class Bun {
    public static function serve(options:BunServeOptions):Void;
}

typedef BunServeOptions = {
    port:Int,
    fetch:Request->EitherType<Response, js.lib.Promise<Response>>,
};
