import os
from django.shortcuts import render
from django.http import Http404
from django.http import JsonResponse
from django.template import TemplateDoesNotExist
from django.conf import settings
import re

def format_topic_name(value):
    """Format topic name for display"""
    if not value:
        return ""
    words = value.replace('-', ' ').split()
    lowercase_words = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with', 'if', 'then', 'else', 'when', 'where', 'how', 'why']
    formatted_words = []
    for i, word in enumerate(words):
        if i == 0 or word.lower() not in lowercase_words:
            formatted_words.append(word.capitalize())
        else:
            formatted_words.append(word.lower())
    return " ".join(formatted_words)

def help_index(request):
    # Template dosyalarından topic'leri al
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    help_templates_dir = os.path.join(templates_dir, 'help')
    exclude = {'index.html', 'help_layout.html', 'sidebar.html', 'help_detail.html'}
    topics = []
    
    # Önce help/ alt klasöründe ara, yoksa direkt templates klasöründe
    search_dir = help_templates_dir if os.path.exists(help_templates_dir) else templates_dir
    
    try:
        for filename in os.listdir(search_dir):
            if filename.endswith('.html') and filename not in exclude:
                slug = filename[:-5].replace('_', '-')
                title = format_topic_name(slug)
                topics.append({
                    'slug': slug,
                    'title': title,
                })
        topics.sort(key=lambda x: x['title'])
    except Exception:
        topics = []
    
    # İki sütuna böl
    total = len(topics)
    mid = (total + 1) // 2
    left_topics = topics[:mid]
    right_topics = topics[mid:]
    left_len = len(left_topics)
    
    return render(request, 'index.html', {
        'left_topics': left_topics,
        'right_topics': right_topics,
        'left_len': left_len,
    })

def help_detail(request, topic):
    # URL'deki topic'i template adına çevir
    # URL'de hem '-' hem '_' olabilir, her ikisini de '_' yap
    template_name = f"{topic.replace('-', '_')}.html"
    
    # Template'in help app'inin templates klasöründe olduğunu kontrol et
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    help_templates_dir = os.path.join(templates_dir, 'help')
    exclude = {'index.html', 'help_layout.html', 'sidebar.html', 'help_detail.html'}
    topics = []
    
    # Önce help/ alt klasöründe ara, yoksa direkt templates klasöründe
    search_dir = help_templates_dir if os.path.exists(help_templates_dir) else templates_dir
    
    try:
        for filename in os.listdir(search_dir):
            if filename.endswith('.html') and filename not in exclude:
                slug = filename[:-5].replace('_', '-')
                title = format_topic_name(slug)
                topics.append({
                    'slug': slug,
                    'title': title,
                })
        topics.sort(key=lambda x: x['title'])
    except Exception as e:
        print(f"Error listing templates: {e}")
        topics = []
    
    # İki sütuna böl (sidebar için)
    total = len(topics)
    mid = (total + 1) // 2
    left_topics = topics[:mid]
    right_topics = topics[mid:]
    left_len = len(left_topics)
    
    # Template'in help app'inin templates klasöründe olduğunu kontrol et
    template_path = os.path.join(templates_dir, template_name)
    if not os.path.exists(template_path):
        raise Http404(f"Help topic not found: {topic}")
    
    try:
        # Template'in help app'inin templates klasöründe olduğunu doğruladık
        # Django template loader kullanırken, INSTALLED_APPS sırasına göre arar
        # Help app'inin template'ini bulmak için template'i normal şekilde yükle
        # Topic listesi sidebar ve detail sayfası için gerekli
        return render(request, template_name, {
            'topic': topic,
            'left_topics': left_topics,
            'right_topics': right_topics,
            'left_len': left_len,
        })
    except Http404:
        raise
    except TemplateDoesNotExist as e:
        print(f"TemplateDoesNotExist: {e}")
        raise Http404(f"Help topic not found: {topic}")
    except Exception as e:
        # Tüm exception'ları yakala ve debug için yazdır
        import traceback
        print(f"Error rendering template {template_name}: {e}")
        print(traceback.format_exc())
        raise Http404(f"Help topic not found: {topic}")

def help_search(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'results': []})
    
    results = []
    lowered_query = query.lower()
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    exclude = {'index.html', 'help_layout.html', 'sidebar.html', 'help_detail.html'}

    try:
        for filename in os.listdir(templates_dir):
            if filename.endswith('.html') and filename not in exclude:
                slug = filename[:-5].replace('_', '-')
                topic_title = format_topic_name(slug)
                template_path = os.path.join(templates_dir, filename)

                with open(template_path, 'r', encoding='utf-8') as f:
                    raw_content = f.read()
                    # Remove all HTML tags and Django template tags, then collapse whitespace
                    content = re.sub(r'{%.*?%}', '', raw_content, flags=re.DOTALL)  # Remove Django block tags
                    content = re.sub(r'{{.*?}}', '', content, flags=re.DOTALL)      # Remove Django variable tags
                    content = re.sub(r'<[^>]+>', '', content)                      # Remove HTML tags
                    content = ' '.join(content.split())
                    content_lower = content.lower()
                    topic_match = lowered_query in topic_title.lower()
                    content_match = lowered_query in content_lower
                    
                    if topic_match or content_match:
                        snippet = ""
                        # If topic name matches, just use the topic name as highlight
                        if topic_match and not content_match:
                            snippet = topic_title
                        else:
                            # Try to highlight/extract a snippet containing the query
                            # Try to extract a sentence or 120 chars around the first match  
                            # Compose the snippet from whole words only
                            idx = content_lower.find(lowered_query)
                            if idx != -1:
                                # Expand to word boundaries around the found index
                                start = max(idx - 60, 0)
                                end = min(idx + 60 + len(query), len(content))

                                # Adjust start to the left for the first space before start.
                                while start > 0 and content[start] not in (' ', '\n'):
                                    start -= 1
                                # Adjust end to the right for the next space after end.
                                while end < len(content) and content[end-1] not in (' ', '\n'):
                                    end += 1
                                # Clamp in case we've gone too far
                                start = max(start, 0)
                                end = min(end, len(content))

                                snippet = content[start:end].replace('\n', ' ').strip()
                            else:
                                snippet = content[:150] + "..." if len(content) > 150 else content
                        
                        results.append({
                            'slug': slug,
                            'title': topic_title,
                            'snippet': snippet
                        })
    except Exception as e:
        print(f"Error in help_search: {e}")
    
    return JsonResponse({'results': results})